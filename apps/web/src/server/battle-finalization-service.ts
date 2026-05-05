import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getBattleWinPoints } from '@batalha/types';
import { calculateRank } from '@batalha/utils';
import { ApiError } from './api-errors';

export interface FinalizeBattleInput {
  battleId: string;
  actorUserId: string;
}

function getPrizeForPlace(
  place: number,
  prizeDistribution?: { first?: number; second?: number; third?: number } | null,
) {
  if (!prizeDistribution) return 0;
  if (place === 1) return Number(prizeDistribution.first ?? 0);
  if (place === 2) return Number(prizeDistribution.second ?? 0);
  if (place === 3) return Number(prizeDistribution.third ?? 0);
  return 0;
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
    (sum, submission) =>
      sum + (typeof submission.voteCount === 'number' ? submission.voteCount : 0),
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
  const totalPublicVotes = submissions.reduce(
    (sum, submission) => sum + getPublicVoteCount(submission),
    0,
  );

  return submissions
    .map((submission) => {
      const publicScore =
        totalPublicVotes > 0 ? (getPublicVoteCount(submission) / totalPublicVotes) * 70 : 0;
      const judgeScore = getJudgeVoteCount(submission) > 0 ? 30 : 0;
      return { submission, score: publicScore + judgeScore };
    })
    .sort((a, b) => b.score - a.score);
}

function hasDuelWinnerTie(battle: Record<string, any>, ranked: ReturnType<typeof rankSubmissions>) {
  if (battle.format !== 'duel' || ranked.length < 2) return false;
  return ranked[0]?.score === ranked[1]?.score;
}

export async function finalizeBattle(
  db: Firestore,
  { battleId, actorUserId }: FinalizeBattleInput,
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

  const submissionsSnapshot = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('status', '==', 'approved')
    .orderBy('voteCount', 'desc')
    .get();
  if (submissionsSnapshot.empty) {
    throw new ApiError(400, 'Nenhuma submissao aprovada encontrada');
  }

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
  if (eligibleSubmissions.length === 0) {
    throw new ApiError(400, 'Nenhum envio de participante confirmado encontrado');
  }

  const rankedSubmissions = rankSubmissions(eligibleSubmissions);
  const seasonId = getSeasonId(battle);
  const category = typeof battle.category === 'string' ? battle.category : null;
  const duelWinnerTie = hasDuelWinnerTie(battle, rankedSubmissions);
  const officialScoringApplied =
    hasEnoughScoringSignal({ battle, entries, submissions }) && !duelWinnerTie;
  const winPoints =
    officialScoringApplied && category
      ? getBattleWinPoints(battle.format === 'duel' ? 'duel' : 'group')
      : 0;
  const winners = rankedSubmissions.slice(0, 3).map(({ submission }, index) => {
    const place = index + 1;
    return {
      userId: String(submission.userId),
      place,
      points: place === 1 ? winPoints : 0,
      prize: getPrizeForPlace(place, battle.prizeDistribution),
    };
  });

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
        ...(winner && winner.place <= 3
          ? { 'stats.topThreeFinishes': FieldValue.increment(1) }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  batch.update(battleRef, {
    status: 'finished',
    winners,
    officialScoringApplied,
    seasonScoringApplied: officialScoringApplied,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, winners, officialScoringApplied };
}
