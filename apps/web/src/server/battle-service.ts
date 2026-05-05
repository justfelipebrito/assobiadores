import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { createCommunityBattleSchema, FREE_TIER_GROUP_CAP } from '@batalha/types';
import { ApiError } from './api-errors';

export interface CreateCommunityBattleParams {
  userId: string;
  userPlan: string;
  body: unknown;
}

export const GROUP_BATTLE_MIN_PARTICIPANTS_FOR_SCORING = 5;
export const BATTLE_CREATE_FUTURE_BUFFER_MS = 60_000;

export async function createCommunityBattle(
  db: Firestore,
  { userId, userPlan, body }: CreateCommunityBattleParams,
) {
  const normalizedBody =
    body && typeof body === 'object' && !Array.isArray(body)
      ? {
          ...body,
          registrationEnd:
            'registrationEnd' in body
              ? (body as { registrationEnd?: unknown }).registrationEnd
              : (body as { submissionDeadline?: unknown }).submissionDeadline,
        }
      : body;
  const parsed = createCommunityBattleSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    throw new ApiError(400, first?.message ?? 'Dados invalidos');
  }

  const input = parsed.data;

  // Free-tier users cannot exceed the group cap
  const isPro = userPlan === 'pro' || userPlan === 'organization';
  if (!isPro && input.format === 'group' && input.maxParticipants > FREE_TIER_GROUP_CAP) {
    throw new ApiError(
      403,
      `Plano gratuito permite no maximo ${FREE_TIER_GROUP_CAP} participantes. Faca upgrade para criar batalhas maiores.`,
    );
  }
  if (
    input.format === 'group' &&
    input.maxParticipants < GROUP_BATTLE_MIN_PARTICIPANTS_FOR_SCORING
  ) {
    throw new ApiError(
      400,
      `Batalhas em grupo precisam de pelo menos ${GROUP_BATTLE_MIN_PARTICIPANTS_FOR_SCORING} participantes.`,
    );
  }

  // Duel battles are always 2 participants
  const maxParticipants = input.format === 'duel' ? 2 : input.maxParticipants;

  // Validate date ordering
  const subDeadline = new Date(input.submissionDeadline);
  const voteStart = new Date(input.votingStart);
  const voteEnd = new Date(input.votingEnd);
  const now = new Date();

  if (subDeadline.getTime() + BATTLE_CREATE_FUTURE_BUFFER_MS <= now.getTime()) {
    throw new ApiError(400, 'Prazo de envio deve ser futuro');
  }
  if (voteStart <= subDeadline)
    throw new ApiError(400, 'Inicio da votacao deve ser apos o prazo de submissao');
  if (voteEnd <= voteStart)
    throw new ApiError(400, 'Fim da votacao deve ser apos o inicio da votacao');

  const battleRef = db.collection('battles').doc();
  await battleRef.set({
    id: battleRef.id,
    title: input.title,
    description: input.description,
    type: 'community',
    format: input.format,
    category: input.category,
    status: 'registration',
    entryFee: 0,
    prizePool: 0,
    prizeDistribution: null,
    votingType: 'public',
    visibility: input.visibility,
    maxParticipants,
    currentParticipants: 0,
    registrationStart: FieldValue.serverTimestamp(),
    registrationEnd: Timestamp.fromDate(subDeadline),
    submissionDeadline: Timestamp.fromDate(subDeadline),
    votingStart: Timestamp.fromDate(voteStart),
    votingEnd: Timestamp.fromDate(voteEnd),
    rules: input.rules,
    judges: [userId],
    winners: [],
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { battleId: battleRef.id };
}
