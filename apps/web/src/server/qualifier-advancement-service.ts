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
import { buildSeasonRankingIncrement, getSeasonRankingPath } from './season-ranking-service';

const QUALIFIER_BRACKET_START = new Date('2026-06-01T00:00:00-03:00');
const QUALIFIER_SEASON_YEAR = 2026;

export interface AdvanceQualifierRoundInput {
  adminUserId: string;
  region?: BrazilState;
  category?: CompetitionCategory;
  eventId?: string;
  roundNumber?: number;
  seasonId?: string;
}

interface WaitingRegistration {
  id: string;
  userId: string;
  region?: BrazilState | null;
  category?: CompetitionCategory;
  currentRound: number;
  createdAt?: unknown;
}

export async function advanceQualifierRound(
  db: Firestore,
  {
    adminUserId,
    region,
    category,
    eventId,
    roundNumber,
    seasonId = QUALIFIER_SEASON_ID,
  }: AdvanceQualifierRoundInput,
) {
  await requireAdmin(db, adminUserId);

  if (!eventId && (!region || !category)) {
    throw new ApiError(400, 'Classificatoria invalida');
  }

  const trackRef = eventId
    ? await getQualifierTrackRefByEventId(db, eventId)
    : db.collection('qualifierTracks').doc(getQualifierTrackId(region!, category!));
  const trackDoc = await trackRef.get();
  if (!trackDoc.exists) throw new ApiError(404, 'Classificatoria nao encontrada');
  const track = trackDoc.data()!;
  const trackRegion = (track.region ?? region ?? null) as BrazilState | null;
  const trackCategory = (track.category ?? category) as CompetitionCategory;
  const bracketStart = getDate(track.bracketStart) ?? QUALIFIER_BRACKET_START;
  const currentRound = roundNumber ?? Number(track.currentRound ?? 0);
  if (currentRound <= 0) throw new ApiError(400, 'Rodada atual invalida');

  let currentRoundMatchesQuery = db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('roundNumber', '==', currentRound);
  currentRoundMatchesQuery = eventId
    ? currentRoundMatchesQuery.where('eventId', '==', eventId)
    : currentRoundMatchesQuery
        .where('region', '==', region!)
        .where('category', '==', category!);
  const currentRoundMatches = await currentRoundMatchesQuery.get();

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
  let existingNextRoundQuery = db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('roundNumber', '==', nextRoundNumber);
  existingNextRoundQuery = eventId
    ? existingNextRoundQuery.where('eventId', '==', eventId)
    : existingNextRoundQuery
        .where('region', '==', region!)
        .where('category', '==', category!);
  const existingNextRound = await existingNextRoundQuery.limit(1).get();
  if (!existingNextRound.empty) {
    throw new ApiError(409, 'A proxima rodada ja foi gerada.');
  }

  let waitingQuery = db
    .collection('qualifierRegistrations')
    .where('seasonId', '==', seasonId)
    .where('status', '==', 'confirmed')
    .where('bracketStatus', '==', 'waiting_draw');
  waitingQuery = eventId
    ? waitingQuery.where('eventId', '==', eventId)
    : waitingQuery.where('region', '==', region!).where('category', '==', category!);
  const waitingSnapshot = await waitingQuery.get();

  const waitingRegistrations = waitingSnapshot.docs
    .map((doc): WaitingRegistration | null => {
      const data = doc.data();
      if (typeof data.userId !== 'string') return null;
      return {
        id: doc.id,
        userId: data.userId,
        region: data.region,
        category: data.category,
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
    const qualifiedUserIds = waitingRegistrations.map((registration) => registration.userId);
    const championshipUpdates = new Map<string, { userIds: string[]; qualifierTrackId: string }>();

    for (const registration of waitingRegistrations) {
      const qualifiedRegion = (registration.region ?? trackRegion) as BrazilState | null;
      const qualifiedCategory = (registration.category ?? trackCategory) as CompetitionCategory;
      const qualifiedChampionshipId = eventId
        ? `championship-national-${QUALIFIER_SEASON_YEAR}-${qualifiedCategory}`
        : `championship-${qualifiedRegion!.toLowerCase()}-${QUALIFIER_SEASON_YEAR}-${qualifiedCategory}`;
      const qualifierTrackId = eventId
        ? String(track.id ?? trackRef.id)
        : getQualifierTrackId(qualifiedRegion!, qualifiedCategory);
      const championshipUpdate = championshipUpdates.get(qualifiedChampionshipId) ?? {
        userIds: [],
        qualifierTrackId,
      };
      championshipUpdate.userIds.push(registration.userId);
      championshipUpdates.set(qualifiedChampionshipId, championshipUpdate);

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
          scope: eventId ? 'national' : 'regional',
          region: qualifiedRegion,
          category: qualifiedCategory,
          bracketStatus: 'qualified',
          qualifiedChampionshipId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      const userRef = db.collection('users').doc(registration.userId);
      const userDoc = await userRef.get();
      const user = userDoc.data() ?? {};
      batch.update(userRef, {
        points: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        xp: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        [`seasonPoints.2026.points`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonPoints.2026.xp`]: FieldValue.increment(SEASON_SCORING.qualifier.qualifyForRegional),
        [`seasonPoints.2026.updatedAt`]: FieldValue.serverTimestamp(),
        [`seasonCategoryPoints.2026.${qualifiedCategory}.points`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonCategoryPoints.2026.${qualifiedCategory}.xp`]: FieldValue.increment(
          SEASON_SCORING.qualifier.qualifyForRegional,
        ),
        [`seasonCategoryPoints.2026.${qualifiedCategory}.updatedAt`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(
        db.doc(getSeasonRankingPath('2026', registration.userId)),
        buildSeasonRankingIncrement({
          user,
          seasonId: '2026',
          category: qualifiedCategory,
          points: SEASON_SCORING.qualifier.qualifyForRegional,
        }),
        { merge: true },
      );
      const pointActivity = buildPointActivity({
        userId: registration.userId,
        points: SEASON_SCORING.qualifier.qualifyForRegional,
        reason: 'qualifier_regional_qualification',
        label: 'Classificacao para Regional',
        sourceType: 'qualifier',
        sourceId: registration.id,
        sourceTitle: eventId
          ? `Mini Classificatoria ${qualifiedCategory}`
          : `Classificatoria ${qualifiedRegion} ${qualifiedCategory}`,
        category: qualifiedCategory,
        seasonId: '2026',
      });
      batch.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
    }

    championshipUpdates.forEach((update, championshipId) => {
      batch.set(
        db.collection('championships').doc(championshipId),
        {
          participantIds: FieldValue.arrayUnion(...update.userIds),
          currentParticipants: update.userIds.length,
          qualifierBattleIds: FieldValue.arrayUnion(update.qualifierTrackId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    batch.set(
      trackRef,
      {
        status: 'finished',
        currentRound,
        winnerId: eventId && qualifiedUserIds.length === 1 ? qualifiedUserIds[0] : null,
        winnerPrizeCents:
          eventId && qualifiedUserIds.length === 1 ? Number(track.prizePoolCents ?? 0) : 0,
        prizeAwardStatus: eventId && qualifiedUserIds.length === 1 ? 'pending_payout' : null,
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
    startsAt: bracketStart,
    seasonId,
    category: trackCategory,
    region: trackRegion ?? 'SP',
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
      scope: eventId ? 'national' : 'regional',
      region: eventId ? null : matchDoc.region,
      format: eventId ? 'mini_knockout' : 'state_qualifier',
      eventId: eventId ?? null,
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

async function getQualifierTrackRefByEventId(db: Firestore, eventId: string) {
  const snapshot = await db
    .collection('qualifierTracks')
    .where('eventId', '==', eventId)
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc) {
    return db.collection('qualifierTracks').doc(`missing-${eventId}`);
  }
  return doc.ref;
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

function getDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const date = new Date(Number((value as { seconds: number }).seconds) * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
