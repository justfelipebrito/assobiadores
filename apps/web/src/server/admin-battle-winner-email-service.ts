import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from './api-errors';

const winnerEmailInputSchema = z.object({
  winnerUserId: z.string().min(1).optional(),
});

function encodeMailtoValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

async function assertAdmin(db: Firestore, adminUserId: string) {
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');

  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem enviar emails de vencedores');
  }
}

export async function createBattleWinnerEmailDraft(
  db: Firestore,
  {
    adminUserId,
    battleId,
    body,
  }: {
    adminUserId: string;
    battleId: string;
    body: unknown;
  },
) {
  if (!battleId) throw new ApiError(400, 'Batalha obrigatoria');

  const parsed = winnerEmailInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    throw new ApiError(400, first?.message ?? 'Dados invalidos');
  }

  await assertAdmin(db, adminUserId);

  const battleDoc = await db.collection('battles').doc(battleId).get();
  if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');

  const battle = battleDoc.data() ?? {};
  const winners = Array.isArray(battle.winners) ? battle.winners : [];
  const winnerUserId =
    parsed.data.winnerUserId ??
    winners.find((winner) => Number(winner?.place) === 1)?.userId;

  if (!winnerUserId || !winners.some((winner) => winner?.userId === winnerUserId)) {
    throw new ApiError(400, 'Selecione um vencedor registrado nesta batalha');
  }

  const winnerDoc = await db.collection('users').doc(winnerUserId).get();
  if (!winnerDoc.exists) throw new ApiError(404, 'Vencedor nao encontrado');

  const winner = winnerDoc.data() ?? {};
  const email = typeof winner.email === 'string' ? winner.email.trim() : '';
  if (!email) throw new ApiError(400, 'Vencedor nao possui email cadastrado');

  const winnerName =
    typeof winner.displayName === 'string' && winner.displayName.trim()
      ? winner.displayName.trim()
      : 'Assobiador';
  const battleTitle =
    typeof battle.title === 'string' && battle.title.trim() ? battle.title.trim() : 'sua batalha';
  const subject = `Premiacao da batalha ${battleTitle}`;
  const message = [
    `Ola, ${winnerName}.`,
    '',
    `Parabens por vencer a batalha "${battleTitle}" na Absolute Assobio.`,
    'Responda este email confirmando seus dados de recebimento para seguirmos com a premiacao.',
    '',
    'Equipe Absolute Assobio',
  ].join('\n');

  return {
    winnerUserId,
    email,
    subject,
    message,
    mailtoHref: `mailto:${encodeURIComponent(email)}?subject=${encodeMailtoValue(
      subject,
    )}&body=${encodeMailtoValue(message)}`,
  };
}
