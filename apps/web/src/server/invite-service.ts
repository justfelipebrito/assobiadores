import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export interface SendBattleInviteParams {
  battleId: string;
  fromUserId: string;
  toUsername: string;
}

export async function sendBattleInvite(
  db: Firestore,
  { battleId, fromUserId, toUsername }: SendBattleInviteParams,
) {
  if (!toUsername?.trim()) throw new ApiError(400, 'Username obrigatorio');

  const [battleDoc, fromUserDoc] = await Promise.all([
    db.collection('battles').doc(battleId).get(),
    db.collection('users').doc(fromUserId).get(),
  ]);
  if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');

  const battle = battleDoc.data()!;
  if (battle.createdBy !== fromUserId) {
    throw new ApiError(403, 'Apenas o criador da batalha pode enviar convites');
  }
  if (battle.status !== 'registration') {
    throw new ApiError(400, 'Convites so podem ser enviados durante a fase de inscricoes');
  }

  const fromDisplayName = fromUserDoc.exists ? (fromUserDoc.data()!.displayName as string) : fromUserId;

  // Resolve toUsername → userId
  const usernameLower = toUsername.trim().toLowerCase();
  const userQuery = await db
    .collection('users')
    .where('usernameLower', '==', usernameLower)
    .limit(1)
    .get();

  if (userQuery.empty) throw new ApiError(404, `Usuario "@${toUsername}" nao encontrado`);

  const toUser = userQuery.docs[0]!;
  const toUserId = toUser.id;

  if (toUserId === fromUserId) throw new ApiError(400, 'Voce nao pode convidar a si mesmo');

  // Prevent duplicate pending invites
  const existing = await db
    .collection('battleInvites')
    .where('battleId', '==', battleId)
    .where('toUserId', '==', toUserId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!existing.empty) throw new ApiError(409, 'Convite ja enviado para este usuario');

  const inviteRef = db.collection('battleInvites').doc();
  await inviteRef.set({
    id: inviteRef.id,
    battleId,
    battleTitle: battle.title as string,
    fromUserId,
    fromDisplayName,
    toUserId,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    inviteId: inviteRef.id,
    toUserId,
    toUsername: toUser.data().username,
    toDisplayName: toUser.data().displayName,
  };
}

export async function respondToInvite(
  db: Firestore,
  { inviteId, userId, accept }: { inviteId: string; userId: string; accept: boolean },
) {
  const inviteDoc = await db.collection('battleInvites').doc(inviteId).get();
  if (!inviteDoc.exists) throw new ApiError(404, 'Convite nao encontrado');

  const invite = inviteDoc.data()!;
  if (invite.toUserId !== userId) throw new ApiError(403, 'Nao autorizado');
  if (invite.status !== 'pending') throw new ApiError(409, 'Convite ja respondido');

  await inviteDoc.ref.update({
    status: accept ? 'accepted' : 'declined',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { status: accept ? 'accepted' : 'declined' };
}
