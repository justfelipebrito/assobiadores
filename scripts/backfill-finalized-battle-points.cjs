const path = require('path');
const { createRequire } = require('module');

const requireFromFunctions = createRequire(
  path.join(__dirname, '..', 'firebase', 'functions', 'package.json'),
);
const { initializeApp, getApps } = requireFromFunctions('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = requireFromFunctions(
  'firebase-admin/firestore',
);

const DRY_RUN = process.argv.includes('--dry-run');
const SEASON_ID_FALLBACK = '2026';
const BATTLE_WIN_POINTS = {
  duel: 10,
  group: 20,
};
const RANKS = [
  { minPoints: 0, name: 'Iniciante' },
  { minPoints: 50, name: 'Aprendiz' },
  { minPoints: 150, name: 'Assobiador' },
  { minPoints: 400, name: 'Assobiador Experiente' },
  { minPoints: 800, name: 'Mestre Assobiador' },
  { minPoints: 1500, name: 'Grão-Mestre' },
  { minPoints: 3000, name: 'Lenda do Assobio' },
];

if (getApps().length === 0) {
  initializeApp({
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      'assobiadores-3f0f6',
  });
}

const db = getFirestore();

function calculateRank(points) {
  for (let index = RANKS.length - 1; index >= 0; index -= 1) {
    if (points >= RANKS[index].minPoints) return RANKS[index].name;
  }
  return RANKS[0].name;
}

function cleanIdPart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function pointActivityId({ battleId, userId }) {
  return ['battle', battleId, 'battle_win', userId].map(cleanIdPart).join('__');
}

function getMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function getSeasonId(battle) {
  if (typeof battle.seasonId === 'string' && battle.seasonId.trim()) return battle.seasonId;
  const millis = getMillis(battle.votingEnd || battle.votingStart || battle.createdAt);
  if (millis) return String(new Date(millis).getUTCFullYear());
  return SEASON_ID_FALLBACK;
}

function getPublicVoteCount(submission) {
  if (typeof submission.publicVoteCount === 'number') return submission.publicVoteCount;
  const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
  const judgeVoteCount =
    typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
  return Math.max(0, voteCount - judgeVoteCount);
}

function getJudgeVoteCount(submission) {
  return typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
}

function rankSubmissions(submissions) {
  return submissions
    .map((submission) => ({
      submission,
      publicVotes: getPublicVoteCount(submission),
      creatorTieBreak: getJudgeVoteCount(submission) > 0 ? 1 : 0,
    }))
    .sort(
      (a, b) => b.publicVotes - a.publicVotes || b.creatorTieBreak - a.creatorTieBreak,
    );
}

function hasUnresolvedWinnerTie(ranked) {
  if (ranked.length < 2) return false;
  return (
    ranked[0].publicVotes === ranked[1].publicVotes &&
    ranked[0].creatorTieBreak === ranked[1].creatorTieBreak
  );
}

function getWinnerPrize(battle) {
  if (typeof battle.prizePool === 'number' && battle.prizePool > 0) return battle.prizePool;
  return Number((battle.prizeDistribution && battle.prizeDistribution.first) || 0);
}

function isEligibleForBattleScoring({ battle, entries, submissions }) {
  if (typeof battle.category !== 'string' || !battle.category.trim()) return false;
  const minParticipants = battle.format === 'group' ? 5 : 2;
  const confirmedUserIds = new Set(entries.map((entry) => entry.userId).filter(Boolean));
  const submittedUserIds = new Set(submissions.map((submission) => submission.userId).filter(Boolean));
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

function rankingUpdate({ user, seasonId, category, points }) {
  const currentSeasonPoints =
    user.seasonPoints && user.seasonPoints[seasonId]
      ? user.seasonPoints[seasonId].points || 0
      : 0;

  return {
    displayName:
      typeof user.displayName === 'string' && user.displayName.trim()
        ? user.displayName.trim()
        : 'Assobiador',
    username:
      typeof user.username === 'string' && user.username.trim() ? user.username.trim() : null,
    state: typeof user.state === 'string' && user.state.length === 2 ? user.state : null,
    birthState:
      typeof user.birthState === 'string' && user.birthState.length === 2
        ? user.birthState
        : null,
    totalPoints: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    rank: calculateRank(currentSeasonPoints + points),
    [`byCategory.${category}`]: FieldValue.increment(points),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function getDocs(collectionName, field, value) {
  const snapshot = await db.collection(collectionName).where(field, '==', value).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function backfillBattle(battleDoc) {
  const battle = { id: battleDoc.id, ...battleDoc.data() };
  const category = typeof battle.category === 'string' ? battle.category : null;
  if (!category) return { status: 'skipped', reason: 'missing-category', battleId: battle.id };

  const entries = (await getDocs('battleEntries', 'battleId', battle.id)).filter(
    (entry) => entry.status === 'confirmed',
  );
  const confirmedUserIds = new Set(entries.map((entry) => entry.userId).filter(Boolean));
  const submissions = (await getDocs('submissions', 'battleId', battle.id)).filter(
    (submission) => submission.status === 'approved' && confirmedUserIds.has(submission.userId),
  );

  if (!isEligibleForBattleScoring({ battle, entries, submissions })) {
    return { status: 'skipped', reason: 'not-eligible', battleId: battle.id };
  }

  const rankedSubmissions = rankSubmissions(submissions);
  if (hasUnresolvedWinnerTie(rankedSubmissions)) {
    return { status: 'skipped', reason: 'unresolved-tie', battleId: battle.id };
  }

  const winnerSubmission = rankedSubmissions[0] && rankedSubmissions[0].submission;
  const winnerId = winnerSubmission && winnerSubmission.userId;
  if (!winnerId) return { status: 'skipped', reason: 'missing-winner', battleId: battle.id };

  const activityId = pointActivityId({ battleId: battle.id, userId: winnerId });
  const activityRef = db.collection('pointActivities').doc(activityId);
  const activityDoc = await activityRef.get();
  if (activityDoc.exists) {
    return { status: 'skipped', reason: 'already-awarded', battleId: battle.id, winnerId };
  }

  const seasonId = getSeasonId(battle);
  const points = BATTLE_WIN_POINTS[battle.format === 'duel' ? 'duel' : 'group'];
  const userRef = db.collection('users').doc(winnerId);
  const userDoc = await userRef.get();
  const user = userDoc.data() || {};
  const currentPoints = typeof user.points === 'number' ? user.points : 0;
  const seasonPoints =
    user.seasonPoints && user.seasonPoints[seasonId]
      ? user.seasonPoints[seasonId].points || 0
      : 0;
  const categoryPoints =
    user.seasonCategoryPoints &&
    user.seasonCategoryPoints[seasonId] &&
    user.seasonCategoryPoints[seasonId][category]
      ? user.seasonCategoryPoints[seasonId][category].points || 0
      : 0;
  const winner = {
    userId: String(winnerId),
    place: 1,
    points,
    prize: getWinnerPrize(battle),
  };

  if (!DRY_RUN) {
    const batch = db.batch();
    batch.update(userRef, {
      points: FieldValue.increment(points),
      xp: FieldValue.increment(points),
      rank: calculateRank(currentPoints + points),
      [`seasonPoints.${seasonId}.points`]: FieldValue.increment(points),
      [`seasonPoints.${seasonId}.xp`]: FieldValue.increment(points),
      [`seasonPoints.${seasonId}.rank`]: calculateRank(seasonPoints + points),
      [`seasonPoints.${seasonId}.updatedAt`]: FieldValue.serverTimestamp(),
      [`seasonCategoryPoints.${seasonId}.${category}.points`]: FieldValue.increment(points),
      [`seasonCategoryPoints.${seasonId}.${category}.xp`]: FieldValue.increment(points),
      [`seasonCategoryPoints.${seasonId}.${category}.rank`]: calculateRank(categoryPoints + points),
      [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]: FieldValue.serverTimestamp(),
      'stats.battlesWon': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      db.doc(`seasonRankings/${seasonId}/users/${winnerId}`),
      rankingUpdate({ user, seasonId, category, points }),
      { merge: true },
    );
    batch.set(activityRef, {
      id: activityId,
      userId: String(winnerId),
      points,
      reason: 'battle_win',
      label: 'Vitoria em batalha',
      sourceType: 'battle',
      sourceId: battle.id,
      sourceTitle: typeof battle.title === 'string' ? battle.title : null,
      category,
      seasonId,
      occurredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      backfilledAt: FieldValue.serverTimestamp(),
    });
    batch.update(db.collection('battles').doc(battle.id), {
      winners: [winner],
      officialScoringApplied: true,
      seasonScoringApplied: true,
      pointsBackfilledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  return {
    status: DRY_RUN ? 'would-award' : 'awarded',
    battleId: battle.id,
    winnerId,
    points,
    seasonId,
  };
}

async function main() {
  const snapshot = await db.collection('battles').where('status', '==', 'finished').get();
  const results = [];

  for (const battleDoc of snapshot.docs) {
    results.push(await backfillBattle(battleDoc));
  }

  const summary = results.reduce((acc, result) => {
    const key = result.status === 'skipped' ? `skipped:${result.reason}` : result.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ dryRun: DRY_RUN, summary, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
