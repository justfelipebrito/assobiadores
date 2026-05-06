import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { SEASON_SCORING, type BrazilState, type CompetitionCategory } from '@batalha/types';
import { ApiError } from './api-errors';
import {
  buildQualifierBracketPlan,
  buildQualifierRoundMatchPlans,
  type QualifierEntrant,
} from '../lib/qualifier-bracket';
import { getQualifierTrackId, QUALIFIER_SEASON_ID } from '../lib/qualifier-tracks';
import { buildPointActivity } from './point-activity-service';

const QUALIFIER_BRACKET_START = new Date('2026-06-01T00:00:00-03:00');
const QUALIFIER_SEASON_YEAR = 2026;

export interface AdvanceQualifierRoundInput {
  adminUserId: string;
  region: BrazilState;
  category: CompetitionCategory;
  roundNumber?: number;
  seasonId?: string;
}

interface WaitingRegistration {
  id: string;
  userId: string;
  currentRound: number;
  createdAt?: unknown;
}

export async function advanceQualifierRound(
  db: Firestore,
  {
    adminUserId,
    region,
    category,
    roundNumber,
    seasonId = QUALIFIER_SEASON_ID,
  }: AdvanceQualifierRoundInput,
) {
  await requireAdmin(db, adminUserId);

  const trackRef = db.collection('qualifierTracks').doc(getQualifierTrackId(region, category));
  const trackDoc = await trackRef.get();
  if (!trackDoc.exists) throw new ApiError(404, 'Classificatoria nao encontrada');
  const track = trackDoc.data()!;
  const currentRound = roundNumber ?? Number(track.currentRound ?? 0);
  if (currentRound <= 0) throw new ApiError(400, 'Rodada atual invalida');

  const currentRoundMatches = await db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .where('roundNumber', '==', currentRound)
    .get();

  if (currentRoundMatches.empty) {
    throw new ApiError(404, 'Nenhum confronto encontrado para esta rodada');
  }

  const unfinishedMatch = currentRoundMatches.docs.find((doc) => {
    const status = doc.data().status;
    return status !== 'finished' && status !== 'walkover';
  });
  if (unfinishedMatch) {
    throw new ApiError(409, 'Finalize todos os confrontos da rodada antes de avancar.');
  }

  const nextRoundNumber = currentRound + 1;
  const existingNextRound = await db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .where('roundNumber', '==', nextRoundNumber)
    .limit(1)
    .get();
  if (!existingNextRound.empty) {
    throw new ApiError(409, 'A proxima rodada ja foi gerada.');
  }

  const waitingSnapshot = await db
    .collection('qualifierRegistrations')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .where('status', '==', 'confirmed')
    .where('bracketStatus', '==', 'waiting_draw')
    .get();

  const waitingRegistrations = waitingSnapshot.docs
    .map((doc): WaitingRegistration | null => {
      const data = doc.data();
      if (typeof data.userId !== 'string') return null;
      return {
        id: doc.id,
        userId: data.userId,
        currentRound: Number(data.currentRound ?? 0),
        createdAt: data.createdAt,
      };
    })
    .filter((registration): registration is WaitingRegistration => Boolean(registration))
    .sort(
      (a, b) => getMillis(a.createdAt) - getMillis(b.createdAt) || a.userId.localeCompare(b.userId),
    );

  if (waitingRegistrations.length === 0) {
    throw new ApiError(400, 'Nao ha participantes vivos para avancar.');
  }

  const maxQualified = Number(track.maxQualified ?? 64);
  const batch = db.batch();

  if (waitingRegistrations.length <= maxQualified) {
    const qualifiedChampionshipId = `championship-${region.toLowerCase()}-${QUALIFIER_SEASON_YEAR}-${category}`;
    const qualifiedUserIds = waitingRegistrations.map((registration) => registration.userId);

    waitingRegistrations.forEach((registration) => {
      batch.update(db.collection('qualifierRegistrations').doc(registration.id), {
        bracketStatus: 'qualified',
        currentRound,
        currentMatchId: null,
        qualifiedChampionshipId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(
        db.collection('qualifierParticipants').doc(registration.id),
        {
          userId: registration.userId,
          seasonId,
          region,
          category,
          bracketStatus: 'qualified',
          qualifiedChampionshipId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batch.update(db.collection('users').doc(registration.userId), {
        points: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        xp: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        [`seasonPoints.2026.points`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonPoints.2026.xp`]: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        [`seasonPoints.2026.updatedAt`]: FieldValue.serverTimestamp(),
        [`seasonCategoryPoints.2026.${category}.points`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonCategoryPoints.2026.${category}.xp`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonCategoryPoints.2026.${category}.updatedAt`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const pointActivity = buildPointActivity({
        userId: registration.userId,
        points: SEASON_SCORING.qualifier.qualifyForRegional,
        reason: 'qualifier_regional_qualification',
        label: 'Classificacao para Regional',
        sourceType: 'qualifier',
        sourceId: registration.id,
        sourceTitle: `Classificatoria ${region} ${category}`,
        category,
        seasonId: '2026',
      });
      batch.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
    });

    batch.set(
      db.collection('championships').doc(qualifiedChampionshipId),
      {
        participantIds: FieldValue.arrayUnion(...qualifiedUserIds),
        currentParticipants: qualifiedUserIds.length,
        qualifierBattleIds: FieldValue.arrayUnion(getQualifierTrackId(region, category)),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    batch.set(
      trackRef,
      {
        status: 'finished',
        currentRound,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();

    return {
      status: 'finished' as const,
      roundNumber: currentRound,
      qualifiedCount: waitingRegistrations.length,
      matchCount: 0,
      byeCount: waitingRegistrations.length,
      pointsAwardedPerQualified: SEASON_SCORING.qualifier.qualifyForRegional,
    };
  }

  const entrants: QualifierEntrant[] = waitingRegistrations.map((registration) => ({
    userId: registration.userId,
    registrationId: registration.id,
  }));
  const fullPlan = buildQualifierBracketPlan({
    participantCount: Number(track.confirmedCount ?? waitingRegistrations.length),
    maxQualified,
  });
  const nextRoundPlan = fullPlan.rounds.find((plan) => plan.roundNumber === nextRoundNumber);
  const startsOnDayIndex =
    nextRoundPlan?.startsOnDayIndex ??
    Math.max(1, ...currentRoundMatches.docs.map((doc) => Number(doc.data().matchDayIndex ?? 1))) +
      1;
  const generation = buildQualifierRoundMatchPlans({
    entrants,
    roundNumber: nextRoundNumber,
    dailyMatchLimit: Number(track.dailyMatchLimit ?? 5),
    startsOnDayIndex,
    startsAt: QUALIFIER_BRACKET_START,
    seasonId,
    category,
    region,
    maxQualified,
  });

  const matchIdsByRegistration = new Map<string, string>();
  generation.matchDocs.forEach((matchDoc) => {
    const matchRef = db.collection('qualifierMatches').doc();
    matchDoc.registrationIds.forEach((registrationId) => {
      matchIdsByRegistration.set(registrationId, matchRef.id);
    });
    batch.set(matchRef, {
      id: matchRef.id,
      ...matchDoc,
      scheduledFor: Timestamp.fromDate(matchDoc.scheduledFor as Date),
      submissionDeadline: Timestamp.fromDate(matchDoc.submissionDeadline as Date),
      votingStart: Timestamp.fromDate(matchDoc.votingStart as Date),
      votingEnd: Timestamp.fromDate(matchDoc.votingEnd as Date),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  waitingRegistrations.forEach((registration) => {
    const matchId = matchIdsByRegistration.get(registration.id);
    batch.update(db.collection('qualifierRegistrations').doc(registration.id), {
      bracketStatus: matchId ? 'active' : 'waiting_draw',
      currentRound: nextRoundNumber,
      currentMatchId: matchId ?? null,
      matchIds: matchId ? FieldValue.arrayUnion(matchId) : [],
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  batch.set(
    trackRef,
    {
      status: 'active',
      currentRound: nextRoundNumber,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return {
    status: 'active' as const,
    roundNumber: nextRoundNumber,
    qualifiedCount: 0,
    matchCount: generation.matchDocs.length,
    byeCount: generation.byeEntrants.length,
    pointsAwardedPerQualified: 0,
  };
}

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem avancar rodadas.');
  }
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
