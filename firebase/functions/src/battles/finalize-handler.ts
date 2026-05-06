import { calculateRank, getBattleWinPoints } from '../domain/ranking';

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
    set(ref: unknown, data: Record<string, unknown>): void;
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

function cleanIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildPointActivityId({
  userId,
  reason,
  sourceType,
  sourceId,
}: {
  userId: string;
  reason: string;
  sourceType: string;
  sourceId: string;
}) {
  return [sourceType, sourceId, reason, userId].map((part) => cleanIdPart(part)).join('__');
}

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

  const totalVotes = submissions.reduce((sum, submission) => sum + getPublicVoteCount(submission), 0);
  if (totalVotes <= 0) {
    return { eligible: false, reason: 'no-public-votes', confirmedParticipantIds };
  }

  return { eligible: true, reason: null, confirmedParticipantIds };
}

export function shouldAwardOfficialBattlePoints(battle: Record<string, unknown>) {
  return hasBattleCategoryForSeasonScoring(battle);
}

function getPublicVoteCount(submission: Record<string, any>) {
  if (typeof submission.publicVoteCount === 'number') return submission.publicVoteCount;
  const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
  const judgeVoteCount =
    typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
  return Math.max(0, voteCount - judgeVoteCount);
}

function getJudgeVoteCount(submission: Record<string, any>) {
  return typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
}

function rankBattleSubmissions(submissions: Array<Record<string, any>>) {
  return submissions
    .map((submission) => ({
      submission,
      publicVotes: getPublicVoteCount(submission),
      creatorTieBreak: getJudgeVoteCount(submission) > 0 ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.publicVotes - a.publicVotes ||
        b.creatorTieBreak - a.creatorTieBreak,
    );
}

function hasUnresolvedWinnerTie(ranked: ReturnType<typeof rankBattleSubmissions>) {
  if (ranked.length < 2) return false;
  return (
    ranked[0]?.publicVotes === ranked[1]?.publicVotes &&
    ranked[0]?.creatorTieBreak === ranked[1]?.creatorTieBreak
  );
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

function getWinnerPrize(battle: Record<string, any>) {
  if (typeof battle.prizePool === 'number' && battle.prizePool > 0) return battle.prizePool;
  return Number(battle.prizeDistribution?.first ?? 0);
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
  const rankedSubmissions = rankBattleSubmissions(submissionData);
  const unresolvedWinnerTie = hasUnresolvedWinnerTie(rankedSubmissions);
  const awardsOfficialPoints = scoringEligibility.eligible && !unresolvedWinnerTie;
  const seasonId = getBattleSeasonId(battle);
  const category = typeof battle.category === 'string' ? battle.category : null;
  const winPoints = getBattleWinPoints(battle.format);
  const batch = db.batch();
  const winners: BattleWinnerResult[] = [];

  if (!unresolvedWinnerTie && rankedSubmissions[0]) {
    const submission = rankedSubmissions[0].submission;
    winners.push({
      userId: submission.userId,
      place: 1,
      points: awardsOfficialPoints ? winPoints : 0,
      prize: getWinnerPrize(battle),
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
        statsUpdate['stats.battlesWon'] = fieldValue.increment(1);
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

      if (pointsAwarded > 0) {
        const activityId = buildPointActivityId({
          userId,
          reason: 'battle_win',
          sourceType: 'battle',
          sourceId: battleId,
        });
        batch.set(db.collection('pointActivities').doc(activityId), {
          id: activityId,
          userId,
          points: pointsAwarded,
          reason: 'battle_win',
          label: 'Vitoria em batalha',
          sourceType: 'battle',
          sourceId: battleId,
          sourceTitle: typeof battle.title === 'string' ? battle.title : null,
          category,
          seasonId,
          occurredAt: fieldValue.serverTimestamp(),
          createdAt: fieldValue.serverTimestamp(),
        });
      }
    }
  }

  batch.update(battleRef, {
    status: 'finished',
    winners,
    officialScoringApplied: awardsOfficialPoints,
    seasonScoringApplied: awardsOfficialPoints,
    seasonScoringEligibility: {
      eligible: scoringEligibility.eligible,
      reason: unresolvedWinnerTie ? 'unresolved-tie' : scoringEligibility.reason,
    },
    updatedAt: fieldValue.serverTimestamp(),
  });

  await batch.commit();
  logger.info(
    `Battle ${battleId} finalized with ${winners.length} winners; official scoring: ${awardsOfficialPoints}`,
  );

  return { success: true, winners, officialScoringApplied: awardsOfficialPoints };
}
