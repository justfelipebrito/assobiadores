import { calculateRank, getBattleWinPoints, getPrizeForPlace } from '../domain/ranking';

export interface FinalizeBattleFieldValue {
  increment(value: number): unknown;
  serverTimestamp(): unknown;
}

export interface FinalizeBattleLogger {
  info(message: string): void;
}

export interface FinalizeBattleFirestore {
  collection(name: string): {
    doc(id?: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, any> | undefined }>;
    };
    where(field: string, operator: string, value: unknown): any;
  };
  batch(): {
    update(ref: unknown, data: Record<string, unknown>): void;
    commit(): Promise<unknown>;
  };
}

export interface FinalizeBattleHttpsErrorFactory {
  new (code: any, message: string): Error;
}

export interface BattleWinnerResult {
  userId: string;
  place: number;
  points: number;
  prize: number;
}

export interface BattleScoringEligibility {
  eligible: boolean;
  reason: string | null;
  confirmedParticipantIds: string[];
}

export const GROUP_BATTLE_MIN_PARTICIPANTS_FOR_SCORING = 5;

export function hasBattleCategoryForSeasonScoring(battle: Record<string, unknown>) {
  return typeof battle.category === 'string' && battle.category.trim().length > 0;
}

export function getBattleScoringEligibility({
  battle,
  entries,
  submissions,
}: {
  battle: Record<string, unknown>;
  entries: Array<Record<string, any>>;
  submissions: Array<Record<string, any>>;
}): BattleScoringEligibility {
  if (!hasBattleCategoryForSeasonScoring(battle)) {
    return { eligible: false, reason: 'missing-category', confirmedParticipantIds: [] };
  }

  const confirmedParticipantIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.userId)
        .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0),
    ),
  );
  const approvedSubmissionUserIds = Array.from(
    new Set(
      submissions
        .map((submission) => submission.userId)
        .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0),
    ),
  );

  const minParticipants = battle.format === 'group' ? GROUP_BATTLE_MIN_PARTICIPANTS_FOR_SCORING : 2;
  if (confirmedParticipantIds.length < minParticipants) {
    return {
      eligible: false,
      reason: 'not-enough-confirmed-participants',
      confirmedParticipantIds,
    };
  }

  const submittedByConfirmedParticipants = approvedSubmissionUserIds.filter((userId) =>
    confirmedParticipantIds.includes(userId),
  );
  if (submittedByConfirmedParticipants.length < minParticipants) {
    return {
      eligible: false,
      reason: 'not-enough-approved-submissions',
      confirmedParticipantIds,
    };
  }

  const totalVotes = submissions.reduce((sum, submission) => {
    const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
    return sum + voteCount;
  }, 0);
  if (totalVotes <= 0) {
    return { eligible: false, reason: 'no-public-votes', confirmedParticipantIds };
  }

  return { eligible: true, reason: null, confirmedParticipantIds };
}

export function shouldAwardOfficialBattlePoints(battle: Record<string, unknown>) {
  return hasBattleCategoryForSeasonScoring(battle);
}

function getBattleSeasonId(battle: Record<string, unknown>) {
  if (typeof battle.seasonId === 'string' && battle.seasonId.trim()) {
    return battle.seasonId;
  }

  const dateSource = battle.votingEnd ?? battle.votingStart ?? battle.createdAt;
  if (dateSource instanceof Date) return String(dateSource.getUTCFullYear());
  if (
    dateSource &&
    typeof dateSource === 'object' &&
    'seconds' in dateSource &&
    typeof dateSource.seconds === 'number'
  ) {
    return String(new Date(dateSource.seconds * 1000).getUTCFullYear());
  }

  return String(new Date().getUTCFullYear());
}

function getNestedSeasonPoints(user: Record<string, any>, seasonId: string, category: string) {
  return {
    seasonPoints: user.seasonPoints?.[seasonId]?.points ?? 0,
    seasonCategoryPoints: user.seasonCategoryPoints?.[seasonId]?.[category]?.points ?? 0,
  };
}

export async function finalizeBattleHandler({
  db,
  battleId,
  fieldValue,
  logger,
  HttpsError,
}: {
  db: FinalizeBattleFirestore;
  battleId: string;
  fieldValue: FinalizeBattleFieldValue;
  logger: FinalizeBattleLogger;
  HttpsError: FinalizeBattleHttpsErrorFactory;
}) {
  if (!battleId) {
    throw new HttpsError('invalid-argument', 'battleId e obrigatorio');
  }

  const battleRef = db.collection('battles').doc(battleId);
  const battleDoc = await battleRef.get();

  if (!battleDoc.exists) {
    throw new HttpsError('not-found', 'Batalha nao encontrada');
  }

  const battle = battleDoc.data()!;
  if (battle.status !== 'voting') {
    throw new HttpsError(
      'failed-precondition',
      'Batalha precisa estar em votacao para ser finalizada',
    );
  }

  const submissions = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('status', '==', 'approved')
    .orderBy('voteCount', 'desc')
    .get();

  if (submissions.empty) {
    throw new HttpsError('failed-precondition', 'Nenhuma submissao aprovada encontrada');
  }

  const entries = await db
    .collection('battleEntries')
    .where('battleId', '==', battleId)
    .where('status', '==', 'confirmed')
    .get();

  const submissionData = submissions.docs.map((doc: { data(): Record<string, any> }) => doc.data());
  const entryData = entries.docs.map((doc: { data(): Record<string, any> }) => doc.data());
  const scoringEligibility = getBattleScoringEligibility({
    battle,
    entries: entryData,
    submissions: submissionData,
  });
  const awardsOfficialPoints = scoringEligibility.eligible;
  const seasonId = getBattleSeasonId(battle);
  const category = typeof battle.category === 'string' ? battle.category : null;
  const winPoints = getBattleWinPoints(battle.format);
  const batch = db.batch();
  const winners: BattleWinnerResult[] = [];

  const topSubmissions = submissions.docs.slice(0, 3);
  for (let i = 0; i < topSubmissions.length; i++) {
    const sub = topSubmissions[i]!;
    const place = i + 1;

    winners.push({
      userId: sub.data().userId,
      place,
      points: awardsOfficialPoints && place === 1 ? winPoints : 0,
      prize: getPrizeForPlace(place, battle.prizeDistribution),
    });
  }

  if (awardsOfficialPoints && category) {
    for (const userId of scoringEligibility.confirmedParticipantIds) {
      const userRef = db.collection('users').doc(userId);
      const winner = winners.find((w) => w.userId === userId);

      const currentUser = await userRef.get();
      const user = currentUser.data() ?? {};
      const pointsAwarded = winner?.points ?? 0;
      const currentPoints = user.points || 0;
      const nestedPoints = getNestedSeasonPoints(user, seasonId, category);
      const newRank = calculateRank(currentPoints + pointsAwarded);
      const seasonRank = calculateRank(nestedPoints.seasonPoints + pointsAwarded);
      const categoryRank = calculateRank(nestedPoints.seasonCategoryPoints + pointsAwarded);

      const statsUpdate: Record<string, unknown> = {
        'stats.battlesEntered': fieldValue.increment(1),
      };

      if (winner) {
        if (winner.place === 1) {
          statsUpdate['stats.battlesWon'] = fieldValue.increment(1);
        }
        if (winner.place <= 3) {
          statsUpdate['stats.topThreeFinishes'] = fieldValue.increment(1);
        }
      }

      batch.update(userRef, {
        ...(pointsAwarded > 0
          ? {
              points: fieldValue.increment(pointsAwarded),
              xp: fieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.points`]: fieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.xp`]: fieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.rank`]: seasonRank,
              [`seasonPoints.${seasonId}.updatedAt`]: fieldValue.serverTimestamp(),
              [`seasonCategoryPoints.${seasonId}.${category}.points`]:
                fieldValue.increment(pointsAwarded),
              [`seasonCategoryPoints.${seasonId}.${category}.xp`]:
                fieldValue.increment(pointsAwarded),
              [`seasonCategoryPoints.${seasonId}.${category}.rank`]: categoryRank,
              [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]:
                fieldValue.serverTimestamp(),
            }
          : {}),
        rank: newRank,
        ...statsUpdate,
        updatedAt: fieldValue.serverTimestamp(),
      });
    }
  }

  batch.update(battleRef, {
    status: 'finished',
    winners,
    officialScoringApplied: awardsOfficialPoints,
    seasonScoringApplied: awardsOfficialPoints,
    seasonScoringEligibility: {
      eligible: scoringEligibility.eligible,
      reason: scoringEligibility.reason,
    },
    updatedAt: fieldValue.serverTimestamp(),
  });

  await batch.commit();
  logger.info(
    `Battle ${battleId} finalized with ${winners.length} winners; official scoring: ${awardsOfficialPoints}`,
  );

  return { success: true, winners, officialScoringApplied: awardsOfficialPoints };
}
