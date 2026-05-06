import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { POINTS_TABLE } from '../domain/ranking';

type QualifierMatchDoc = FirebaseFirestore.QueryDocumentSnapshot;

function getMillis(value: unknown) {
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

function getSubmissionVoteCount(submission: Record<string, unknown>) {
  return typeof submission.publicVoteCount === 'number' ? submission.publicVoteCount : 0;
}

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

function buildPhaseAdvancePointActivity({
  userId,
  matchId,
  roundNumber,
  category,
}: {
  userId: string;
  matchId: string;
  roundNumber: number;
  category: string;
}) {
  const id = buildPointActivityId({
    userId,
    reason: 'qualifier_phase_advance',
    sourceType: 'qualifier',
    sourceId: matchId,
  });

  return {
    id,
    userId,
    points: POINTS_TABLE.qualifierPhaseAdvance,
    reason: 'qualifier_phase_advance',
    label: 'Avanco em Classificatoria',
    sourceType: 'qualifier',
    sourceId: matchId,
    sourceTitle: `Rodada ${roundNumber}`,
    category,
    seasonId: '2026',
    occurredAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}

function buildPhaseAdvancePointsUpdate(category: string) {
  const points = POINTS_TABLE.qualifierPhaseAdvance;

  return {
    points: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    [`seasonPoints.2026.points`]: FieldValue.increment(points),
    [`seasonPoints.2026.xp`]: FieldValue.increment(points),
    [`seasonPoints.2026.updatedAt`]: FieldValue.serverTimestamp(),
    [`seasonCategoryPoints.2026.${category}.points`]: FieldValue.increment(points),
    [`seasonCategoryPoints.2026.${category}.xp`]: FieldValue.increment(points),
    [`seasonCategoryPoints.2026.${category}.updatedAt`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function finalizeScheduledQualifierMatch(
  db: Firestore,
  matchId: string,
  { now = new Date() }: { now?: Date } = {},
) {
  return db.runTransaction(async (transaction) => {
    const matchRef = db.collection('qualifierMatches').doc(matchId);
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists) return { matchId, finalized: false, reason: 'missing' };

    const match = matchDoc.data() ?? {};
    if (match.status !== 'voting') {
      return { matchId, finalized: false, reason: 'not_voting' };
    }
    if (getMillis(match.votingEnd) > now.getTime()) {
      return { matchId, finalized: false, reason: 'voting_open' };
    }

    const submissionsSnapshot = await transaction.get(
      db.collection('qualifierSubmissions').where('matchId', '==', matchId),
    );
    const votesSnapshot = await transaction.get(
      db.collection('qualifierVotes').where('matchId', '==', matchId),
    );
    const submitted = submissionsSnapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((submission) => submission.data.status === 'submitted');
    const participantIds = Array.isArray(match.participantIds) ? match.participantIds : [];
    const registrationIds = Array.isArray(match.registrationIds) ? match.registrationIds : [];
    const submittedUserIds = new Set(submitted.map((submission) => String(submission.data.userId)));
    const missingUserIds = participantIds.filter((userId: string) => !submittedUserIds.has(userId));

    let winnerId: string | null = null;
    let status: 'finished' | 'walkover' = 'finished';
    let walkoverWinnerId: string | null = null;

    if (submitted.length === 0) {
      status = 'walkover';
    } else if (submitted.length === 1) {
      status = 'walkover';
      winnerId = String(submitted[0]!.data.userId);
      walkoverWinnerId = winnerId;
    } else {
      const sorted = submitted.sort((a, b) => {
        const voteDiff = getSubmissionVoteCount(b.data) - getSubmissionVoteCount(a.data);
        if (voteDiff !== 0) return voteDiff;
        return String(a.id).localeCompare(String(b.id));
      });
      const topVoteCount = getSubmissionVoteCount(sorted[0]!.data);
      const tiedUserIds = new Set(
        sorted
          .filter((submission) => getSubmissionVoteCount(submission.data) === topVoteCount)
          .map((submission) => String(submission.data.userId)),
      );
      const tiedVotes = votesSnapshot.docs
        .map((doc) => doc.data())
        .filter((vote) => tiedUserIds.has(String(vote.votedUserId)))
        .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
      winnerId = tiedVotes[0]
        ? String(tiedVotes[0].votedUserId)
        : String(sorted[0]!.data.userId);
    }

    transaction.update(matchRef, {
      status,
      winnerId,
      walkoverWinnerId,
      disqualifiedUserIds: missingUserIds,
      updatedAt: FieldValue.serverTimestamp(),
    });

    registrationIds.forEach((registrationId: string) => {
      const participantIndex = registrationIds.indexOf(registrationId);
      const registrationUserId = participantIds[participantIndex];
      const isWinner = winnerId && registrationUserId === winnerId;

      transaction.update(db.collection('qualifierRegistrations').doc(registrationId), {
        bracketStatus: isWinner ? 'waiting_draw' : 'eliminated',
        currentMatchId: isWinner ? null : matchId,
        currentRound: isWinner
          ? Number(match.roundNumber ?? 1) + 1
          : Number(match.roundNumber ?? 1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (winnerId) {
      transaction.update(
        db.collection('users').doc(winnerId),
        buildPhaseAdvancePointsUpdate(String(match.category)),
      );
      const activity = buildPhaseAdvancePointActivity({
        userId: winnerId,
        matchId,
        roundNumber: Number(match.roundNumber ?? 1),
        category: String(match.category),
      });
      transaction.set(db.collection('pointActivities').doc(activity.id), activity);
    }

    return { matchId, finalized: true, status, winnerId };
  });
}

export async function finalizeDueQualifierMatches(
  db: Firestore,
  { now = new Date(), limit = 100 }: { now?: Date; limit?: number } = {},
) {
  const dueMatches = await db
    .collection('qualifierMatches')
    .where('status', '==', 'voting')
    .where('votingEnd', '<=', Timestamp.fromDate(now))
    .limit(limit)
    .get();

  const results = [];
  for (const matchDoc of dueMatches.docs as QualifierMatchDoc[]) {
    results.push(await finalizeScheduledQualifierMatch(db, matchDoc.id, { now }));
  }

  const finalizedCount = results.filter((result) => result.finalized).length;
  logger.info(`Finalized ${finalizedCount} due qualifier match(es).`);

  return {
    checkedCount: dueMatches.size,
    finalizedCount,
    results,
  };
}
