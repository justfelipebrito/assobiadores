import type { Firestore, FieldValue } from 'firebase-admin/firestore';
import {
  calculateRank,
  getPointsForPlace,
  getPrizeForPlace,
  POINTS_TABLE,
} from '../domain/ranking';

const CHAMPIONSHIP_POINTS_MULTIPLIER = 2;

export interface FinalizeChampionshipDeps {
  db: Firestore;
  fieldValue: typeof FieldValue;
  logger: { info: (msg: string) => void };
}

export interface ChampionshipWinner {
  userId: string;
  place: number;
  points: number;
  prize: number;
}

export interface FinalizeChampionshipResult {
  champion: string | null;
  winners: ChampionshipWinner[];
  participantCount: number;
}

export async function finalizeChampionshipHandler(
  championshipId: string,
  { db, fieldValue, logger }: FinalizeChampionshipDeps,
): Promise<FinalizeChampionshipResult> {
  const champRef = db.collection('championships').doc(championshipId);
  const champDoc = await champRef.get();

  if (!champDoc.exists) {
    throw new Error(`Championship ${championshipId} not found`);
  }

  const champ = champDoc.data()!;
  if (champ.status === 'finished') {
    throw new Error(`Championship ${championshipId} is already finished`);
  }

  // Verify all stages are finished
  const stagesSnap = await champRef.collection('stages').get();
  const activeStages = stagesSnap.docs.filter((d) => d.data().status !== 'finished');
  if (activeStages.length > 0) {
    throw new Error(`${activeStages.length} stage(s) still active`);
  }

  // Find champion from the Final stage
  let champion: string | null = null;
  let runnerUp: string | null = null;

  const finalStage = stagesSnap.docs.find((d) => d.data().name === 'Final');
  if (finalStage) {
    const finalMatches = await finalStage.ref.collection('matches').get();
    const finishedFinalMatch = finalMatches.docs
      .filter((m) => m.data().status === 'finished')
      .sort((a, b) => (b.data().updatedAt?.seconds ?? 0) - (a.data().updatedAt?.seconds ?? 0))[0];

    if (finishedFinalMatch) {
      const matchData = finishedFinalMatch.data();
      champion = matchData.winnerId ?? null;
      runnerUp = (matchData.participantIds ?? []).find((id: string) => id !== champion) ?? null;
    }
  }

  // Collect all participants across all matches
  const participantIds = new Set<string>();
  for (const stageDoc of stagesSnap.docs) {
    const matchesSnap = await stageDoc.ref.collection('matches').get();
    matchesSnap.docs.forEach((m) => {
      (m.data().participantIds ?? []).forEach((uid: string) => participantIds.add(uid));
    });
  }

  const placementMap = new Map<string, number>();
  if (champion) placementMap.set(champion, 1);
  if (runnerUp) placementMap.set(runnerUp, 2);

  const winners: ChampionshipWinner[] = [];
  const batch = db.batch();

  for (const userId of participantIds) {
    const place = placementMap.get(userId) ?? 0;
    const basePoints = place > 0 ? getPointsForPlace(place) : POINTS_TABLE.participation;
    const pointsAwarded = basePoints * CHAMPIONSHIP_POINTS_MULTIPLIER;
    const prize = place > 0 ? getPrizeForPlace(place, champ.prizeDistribution) : 0;

    if (place > 0) {
      winners.push({ userId, place, points: pointsAwarded, prize });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const currentPoints = userDoc.data()?.points ?? 0;
    const newRank = calculateRank(currentPoints + pointsAwarded);

    const statsUpdate: Record<string, unknown> = {
      'stats.battlesEntered': fieldValue.increment(1),
    };
    if (place === 1) statsUpdate['stats.battlesWon'] = fieldValue.increment(1);
    if (place <= 3 && place > 0) statsUpdate['stats.topThreeFinishes'] = fieldValue.increment(1);

    batch.update(db.collection('users').doc(userId), {
      points: fieldValue.increment(pointsAwarded),
      xp: fieldValue.increment(pointsAwarded),
      rank: newRank,
      ...(champ.seasonId
        ? {
            [`seasonPoints.${champ.seasonId}.points`]: fieldValue.increment(pointsAwarded),
            [`seasonPoints.${champ.seasonId}.xp`]: fieldValue.increment(pointsAwarded),
            [`seasonPoints.${champ.seasonId}.rank`]: newRank,
            [`seasonPoints.${champ.seasonId}.updatedAt`]: fieldValue.serverTimestamp(),
          }
        : {}),
      ...(champ.seasonId && champ.category
        ? {
            [`seasonCategoryPoints.${champ.seasonId}.${champ.category}.points`]:
              fieldValue.increment(pointsAwarded),
            [`seasonCategoryPoints.${champ.seasonId}.${champ.category}.xp`]:
              fieldValue.increment(pointsAwarded),
            [`seasonCategoryPoints.${champ.seasonId}.${champ.category}.rank`]: newRank,
            [`seasonCategoryPoints.${champ.seasonId}.${champ.category}.updatedAt`]:
              fieldValue.serverTimestamp(),
          }
        : {}),
      ...statsUpdate,
      updatedAt: fieldValue.serverTimestamp(),
    });
  }

  batch.update(champRef, {
    status: 'finished',
    winners,
    updatedAt: fieldValue.serverTimestamp(),
  });

  await batch.commit();
  logger.info(`Championship ${championshipId} finalized. Champion: ${champion}`);

  return { champion, winners, participantCount: participantIds.size };
}
