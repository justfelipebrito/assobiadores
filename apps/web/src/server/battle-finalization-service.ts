import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getBattleWinPoints, type CompetitionCategory } from '@batalha/types';
import { calculateRank } from '@batalha/utils';
import { ApiError } from './api-errors';
import { buildPointActivity } from './point-activity-service';
import { buildSeasonRankingIncrement, getSeasonRankingPath } from './season-ranking-service';

export interface FinalizeBattleInput {
  battleId: string;
  actorUserId: string;
  now?: Date;
}

function getWinnerPrize(battle: Record<string, any>) {
  if (typeof battle.prizePool === 'number' && battle.prizePool > 0) return battle.prizePool;
  return Number(battle.prizeDistribution?.first ?? 0);
}

function getSeasonId(battle: Record<string, any>) {
  if (typeof battle.seasonId === 'string' && battle.seasonId.trim()) return battle.seasonId;
  const source = battle.votingEnd ?? battle.votingStart ?? battle.createdAt;
  if (source && typeof source === 'object' && 'seconds' in source) {
    return String(new Date(Number(source.seconds) * 1000).getUTCFullYear());
  }
  return String(new Date().getUTCFullYear());
}

function getNestedSeasonPoints(user: Record<string, any>, seasonId: string, category: string) {
  return {
    seasonPoints: user.seasonPoints?.[seasonId]?.points ?? 0,
    seasonCategoryPoints: user.seasonCategoryPoints?.[seasonId]?.[category]?.points ?? 0,
  };
}

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function hasEnoughScoringSignal({
  battle,
  entries,
  submissions,
}: {
  battle: Record<string, any>;
  entries: Array<Record<string, any>>;
  submissions: Array<Record<string, any>>;
}) {
  if (typeof battle.category !== 'string' || !battle.category.trim()) return false;
  const minParticipants = battle.format === 'group' ? 5 : 2;
  const confirmedUserIds = new Set(entries.map((entry) => entry.userId).filter(Boolean));
  const submittedUserIds = new Set(
    submissions.map((submission) => submission.userId).filter(Boolean),
  );
  const submittedConfirmedCount = Array.from(submittedUserIds).filter((userId) =>
    confirmedUserIds.has(userId),
  ).length;
  const totalVotes = submissions.reduce(
    (sum, submission) => sum + getPublicVoteCount(submission),
    0,
  );

  return (
    confirmedUserIds.size >= minParticipants &&
    submittedConfirmedCount >= minParticipants &&
    totalVotes > 0
  );
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

function rankSubmissions(submissions: Array<Record<string, any>>) {
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

function hasUnresolvedWinnerTie(ranked: ReturnType<typeof rankSubmissions>) {
  if (ranked.length < 2) return false;
  return (
    ranked[0]?.publicVotes === ranked[1]?.publicVotes &&
    ranked[0]?.creatorTieBreak === ranked[1]?.creatorTieBreak
  );
}

export async function finalizeBattle(
  db: Firestore,
  { battleId, actorUserId, now = new Date() }: FinalizeBattleInput,
) {
  if (!battleId) throw new ApiError(400, 'Batalha invalida');
  if (!actorUserId) throw new ApiError(401, 'Nao autorizado');

  const battleRef = db.collection('battles').doc(battleId);
  const battleDoc = await battleRef.get();
  if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');

  const battle = battleDoc.data()!;
  const actorDoc = await db.collection('users').doc(actorUserId).get();
  const isAdmin = actorDoc.exists && actorDoc.data()?.role === 'admin';
  const isCreator = battle.createdBy === actorUserId;
  if (!isAdmin && !isCreator) {
    throw new ApiError(403, 'Apenas o criador pode finalizar esta batalha');
  }

  if (battle.status !== 'voting') {
    throw new ApiError(400, 'Batalha precisa estar em votacao para ser finalizada');
  }

  const votingEndMillis = getTimestampMillis(battle.votingEnd);
  if (!votingEndMillis) {
    throw new ApiError(400, 'Data de encerramento da votacao invalida');
  }
  if (now.getTime() < votingEndMillis) {
    throw new ApiError(400, 'Votacao ainda nao encerrou');
  }

  const submissionsSnapshot = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('status', '==', 'approved')
    .get();
  const entriesSnapshot = await db
    .collection('battleEntries')
    .where('battleId', '==', battleId)
    .where('status', '==', 'confirmed')
    .get();

  const submissions = submissionsSnapshot.docs.map((doc) => doc.data());
  const entries = entriesSnapshot.docs.map((doc) => doc.data());
  const confirmedUserIds = new Set(entries.map((entry) => entry.userId).filter(Boolean));
  const eligibleSubmissions = submissions.filter((submission) =>
    confirmedUserIds.has(submission.userId),
  );

  if (submissions.length === 0 || eligibleSubmissions.length === 0) {
    const noWinnerReason =
      submissions.length === 0 ? 'no-approved-submissions' : 'no-confirmed-participant-submissions';
    const batch = db.batch();
    batch.update(battleRef, {
      status: 'finished',
      winners: [],
      officialScoringApplied: false,
      seasonScoringApplied: false,
      seasonScoringEligibility: {
        eligible: false,
        reason: noWinnerReason,
      },
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { success: true, winners: [], officialScoringApplied: false };
  }

  const rankedSubmissions = rankSubmissions(eligibleSubmissions);
  const seasonId = getSeasonId(battle);
  const category = typeof battle.category === 'string' ? battle.category : null;
  const pointActivityCategory = category as CompetitionCategory | null;
  const unresolvedWinnerTie = hasUnresolvedWinnerTie(rankedSubmissions);
  if (unresolvedWinnerTie) {
    throw new ApiError(409, 'Desempate pendente antes da finalizacao');
  }
  const officialScoringApplied =
    hasEnoughScoringSignal({ battle, entries, submissions }) && !unresolvedWinnerTie;
  const winPoints =
    officialScoringApplied && category
      ? getBattleWinPoints(battle.format === 'duel' ? 'duel' : 'group')
      : 0;
  const winnerSubmission = unresolvedWinnerTie ? null : rankedSubmissions[0]?.submission;
  const winners = winnerSubmission
    ? [
        {
          userId: String(winnerSubmission.userId),
          place: 1,
          points: winPoints,
          prize: getWinnerPrize(battle),
        },
      ]
    : [];

  const batch = db.batch();
  const participantIds = Array.from(confirmedUserIds);

  if (category) {
    for (const userId of participantIds) {
      const userRef = db.collection('users').doc(String(userId));
      const userDoc = await userRef.get();
      const user = userDoc.data() ?? {};
      const winner = winners.find((item) => item.userId === userId);
      const pointsAwarded = winner?.points ?? 0;
      const currentPoints = typeof user.points === 'number' ? user.points : 0;
      const nested = getNestedSeasonPoints(user, seasonId, category);

      batch.update(userRef, {
        ...(pointsAwarded > 0
          ? {
              points: FieldValue.increment(pointsAwarded),
              xp: FieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.points`]: FieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.xp`]: FieldValue.increment(pointsAwarded),
              [`seasonPoints.${seasonId}.rank`]: calculateRank(nested.seasonPoints + pointsAwarded),
              [`seasonPoints.${seasonId}.updatedAt`]: FieldValue.serverTimestamp(),
              [`seasonCategoryPoints.${seasonId}.${category}.points`]:
                FieldValue.increment(pointsAwarded),
              [`seasonCategoryPoints.${seasonId}.${category}.xp`]:
                FieldValue.increment(pointsAwarded),
              [`seasonCategoryPoints.${seasonId}.${category}.rank`]: calculateRank(
                nested.seasonCategoryPoints + pointsAwarded,
              ),
              [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]:
                FieldValue.serverTimestamp(),
            }
          : {}),
        rank: calculateRank(currentPoints + pointsAwarded),
        'stats.battlesEntered': FieldValue.increment(1),
        ...(winner?.place === 1 ? { 'stats.battlesWon': FieldValue.increment(1) } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (pointsAwarded > 0) {
        batch.set(
          db.doc(getSeasonRankingPath(seasonId, String(userId))),
          buildSeasonRankingIncrement({
            user,
            seasonId,
            category,
            points: pointsAwarded,
          }),
          { merge: true },
        );
        const pointActivity = buildPointActivity({
          userId: String(userId),
          points: pointsAwarded,
          reason: 'battle_win',
          label: 'Vitoria em batalha',
          sourceType: 'battle',
          sourceId: battleId,
          sourceTitle: typeof battle.title === 'string' ? battle.title : null,
          category: pointActivityCategory,
          seasonId,
        });
        batch.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
      }
    }
  }

  batch.update(battleRef, {
    status: 'finished',
    winners,
    officialScoringApplied,
    seasonScoringApplied: officialScoringApplied,
    finalizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, winners, officialScoringApplied };
}
