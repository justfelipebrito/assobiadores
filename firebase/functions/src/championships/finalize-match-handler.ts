import type { Firestore, FieldValue } from 'firebase-admin/firestore';

export interface FinalizeMatchDeps {
  db: Firestore;
  fieldValue: typeof FieldValue;
  logger: { info: (msg: string) => void };
}

export interface FinalizeMatchInput {
  championshipId: string;
  stageId: string;
  matchId: string;
}

export interface FinalizeMatchResult {
  winnerId: string | null;
  stageFinished: boolean;
}

export async function finalizeMatchHandler(
  { championshipId, stageId, matchId }: FinalizeMatchInput,
  { db, fieldValue, logger }: FinalizeMatchDeps,
): Promise<FinalizeMatchResult> {
  const matchRef = db
    .collection('championships')
    .doc(championshipId)
    .collection('stages')
    .doc(stageId)
    .collection('matches')
    .doc(matchId);

  const matchDoc = await matchRef.get();
  if (!matchDoc.exists) {
    throw new Error(`Match ${matchId} not found`);
  }

  const match = matchDoc.data()!;
  if (match.status !== 'voting') {
    throw new Error(`Match ${matchId} must be in voting status to finalize (current: ${match.status})`);
  }

  // Determine winner and scores from linked battle submissions
  let winnerId: string | null = null;
  const scores: Record<string, number> = {};

  if (match.battleId) {
    const allSubs = await db
      .collection('submissions')
      .where('battleId', '==', match.battleId)
      .where('status', '==', 'approved')
      .orderBy('voteCount', 'desc')
      .get();

    allSubs.docs.forEach((sub) => {
      scores[sub.data().userId] = sub.data().voteCount ?? 0;
    });

    if (!allSubs.empty) {
      winnerId = allSubs.docs[0]!.data().userId;
    }
  }

  const batch = db.batch();
  batch.update(matchRef, {
    status: 'finished',
    winnerId,
    scores,
    updatedAt: fieldValue.serverTimestamp(),
  });

  // Mark stage finished if this was the last active match
  const stageRef = db
    .collection('championships')
    .doc(championshipId)
    .collection('stages')
    .doc(stageId);

  const allMatches = await stageRef.collection('matches').get();
  const remainingActive = allMatches.docs.filter(
    (d) => d.id !== matchId && d.data().status !== 'finished',
  );

  let stageFinished = false;
  if (remainingActive.length === 0) {
    batch.update(stageRef, {
      status: 'finished',
      updatedAt: fieldValue.serverTimestamp(),
    });
    stageFinished = true;
    logger.info(`Stage ${stageId} of championship ${championshipId} finished`);
  }

  await batch.commit();
  logger.info(`Match ${matchId} finalized. Winner: ${winnerId ?? 'none'}`);

  return { winnerId, stageFinished };
}
