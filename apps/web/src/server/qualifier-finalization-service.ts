import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  SEASON_SCORING,
  type BrazilState,
  type CompetitionCategory,
} from '@batalha/types';
import { ApiError } from './api-errors';
import { getQualifierTrackId, QUALIFIER_SEASON_ID } from '../lib/qualifier-tracks';
import { buildPointActivity } from './point-activity-service';

export interface FinalizeQualifierMatchInput {
  matchId: string;
  adminUserId: string;
}

export interface FinalizeQualifierRoundInput {
  adminUserId: string;
  region: BrazilState;
  category: CompetitionCategory;
  roundNumber?: number;
  seasonId?: string;
}

function getSubmissionVoteCount(submission: Record<string, unknown>) {
  return typeof submission.publicVoteCount === 'number' ? submission.publicVoteCount : 0;
}

function getMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function buildPointsUpdate(category: string, points: number) {
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

export async function finalizeQualifierMatch(
  db: Firestore,
  { matchId, adminUserId }: FinalizeQualifierMatchInput,
) {
  if (!matchId) throw new ApiError(400, 'Confronto invalido');
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');

  return db.runTransaction(async (transaction) => {
    const adminRef = db.collection('users').doc(adminUserId);
    const adminDoc = await transaction.get(adminRef);
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      throw new ApiError(403, 'Apenas administradores podem finalizar confrontos');
    }

    const matchRef = db.collection('qualifierMatches').doc(matchId);
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists) throw new ApiError(404, 'Confronto nao encontrado');

    const match = matchDoc.data()!;
    if (match.status !== 'voting') {
      throw new ApiError(400, 'Confronto precisa estar em votacao para ser finalizado');
    }

    const submissionsSnapshot = await transaction.get(
      db.collection('qualifierSubmissions').where('matchId', '==', matchId),
    );
    const submitted = submissionsSnapshot.docs
      .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
      .filter((submission) => submission.data.status === 'submitted');
    const votesSnapshot = await transaction.get(
      db.collection('qualifierVotes').where('matchId', '==', matchId),
    );
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
      const firstVoteForTiedUser =
        tiedVotes.find((vote) => vote.voterType === 'judge') ?? tiedVotes[0];
      winnerId = firstVoteForTiedUser
        ? String(firstVoteForTiedUser.votedUserId)
        : String(sorted[0]!.data.userId);
    }

    const loserIds = participantIds.filter((userId: string) => userId !== winnerId);

    transaction.update(matchRef, {
      status,
      winnerId,
      walkoverWinnerId,
      disqualifiedUserIds: missingUserIds,
      updatedAt: FieldValue.serverTimestamp(),
    });

    registrationIds.forEach((registrationId: string) => {
      const registrationRef = db.collection('qualifierRegistrations').doc(registrationId);
      const participantIndex = registrationIds.indexOf(registrationId);
      const registrationUserId = participantIds[participantIndex];
      const isWinner = winnerId && registrationUserId === winnerId;

      transaction.update(registrationRef, {
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
        buildPointsUpdate(String(match.category), SEASON_SCORING.qualifier.phaseAdvance),
      );
      const pointActivity = buildPointActivity({
        userId: winnerId,
        points: SEASON_SCORING.qualifier.phaseAdvance,
        reason: 'qualifier_phase_advance',
        label: 'Avanco em Classificatoria',
        sourceType: 'qualifier',
        sourceId: matchId,
        sourceTitle: `Rodada ${Number(match.roundNumber ?? 1)}`,
        category: String(match.category) as CompetitionCategory,
        seasonId: '2026',
      });
      transaction.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
    }

    return {
      matchId,
      status,
      winnerId,
      walkoverWinnerId,
      disqualifiedUserIds: missingUserIds,
      eliminatedUserIds: loserIds,
      pointsAwarded: winnerId ? SEASON_SCORING.qualifier.phaseAdvance : 0,
    };
  });
}

export async function finalizeQualifierRound(
  db: Firestore,
  {
    adminUserId,
    region,
    category,
    roundNumber,
    seasonId = QUALIFIER_SEASON_ID,
  }: FinalizeQualifierRoundInput,
) {
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');

  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem finalizar confrontos');
  }

  const trackDoc = await db
    .collection('qualifierTracks')
    .doc(getQualifierTrackId(region, category))
    .get();
  if (!trackDoc.exists) throw new ApiError(404, 'Classificatoria nao encontrada');

  const currentRound = roundNumber ?? Number(trackDoc.data()?.currentRound ?? 0);
  if (currentRound <= 0) throw new ApiError(400, 'Rodada atual invalida');

  const matchesSnapshot = await db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .where('roundNumber', '==', currentRound)
    .get();

  if (matchesSnapshot.empty) {
    throw new ApiError(404, 'Nenhum confronto encontrado para esta rodada');
  }

  const votingMatchIds = matchesSnapshot.docs
    .filter((doc) => doc.data().status === 'voting')
    .map((doc) => doc.id);

  const results = [];
  for (const matchId of votingMatchIds) {
    results.push(await finalizeQualifierMatch(db, { matchId, adminUserId }));
  }

  return {
    region,
    category,
    roundNumber: currentRound,
    finalizedCount: results.length,
    skippedCount: matchesSnapshot.size - results.length,
    results,
  };
}
