import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  type BrazilState,
  type CompetitionCategory,
} from '@batalha/types';
import { buildInitialQualifierMatchPlans } from '../lib/qualifier-bracket';
import {
  getMiniQualifierEventId,
  getMiniQualifierTrackId,
  getMiniQualifierTrackSlug,
  getMiniQualifierTrackTitle,
  getQualifierTrackId,
  MINI_QUALIFIER_CATEGORY,
  QUALIFIER_SEASON_ID,
  QUALIFIER_SEASON_YEAR,
} from '../lib/qualifier-tracks';
import { ApiError } from './api-errors';

const MINI_LAST_CALL_DEADLINE = new Date('2026-06-30T23:59:59-03:00');
const MINI_BRACKET_START = new Date('2026-07-01T00:00:00-03:00');
const MINI_BRACKET_END = new Date('2026-07-07T23:59:59-03:00');
const MINI_BRACKET_PLAN_REGION: BrazilState = 'SP';
const PLATFORM_FEE_PERCENT = 20;
const PRIZE_POOL_PERCENT = 80;

interface SourceRegistration {
  id: string;
  userId: string;
  region: BrazilState;
  category: CompetitionCategory;
  paymentId: string | null;
  entryFeeCents: number;
  platformFeePercent: number;
  prizePoolPercent: number;
  createdAt?: unknown;
}

export interface MigrateQualifierEntriesToMiniInput {
  adminUserId: string;
  category: CompetitionCategory;
  seasonId?: string;
  registrationDeadline?: Date;
  bracketStart?: Date;
  bracketEnd?: Date;
}

export async function migrateQualifierEntriesToMiniKnockout(
  db: Firestore,
  {
    adminUserId,
    category,
    seasonId = QUALIFIER_SEASON_ID,
    registrationDeadline = MINI_LAST_CALL_DEADLINE,
    bracketStart = MINI_BRACKET_START,
    bracketEnd = MINI_BRACKET_END,
  }: MigrateQualifierEntriesToMiniInput,
) {
  await requireAdmin(db, adminUserId);
  if (category !== MINI_QUALIFIER_CATEGORY) {
    throw new ApiError(400, 'Mini Classificatoria esta disponivel apenas para Freestyle.');
  }

  const eventId = getMiniQualifierEventId(category);
  const trackId = getMiniQualifierTrackId(category);
  const existingMatches = await db
    .collection('qualifierMatches')
    .where('eventId', '==', eventId)
    .limit(1)
    .get();

  if (!existingMatches.empty) {
    throw new ApiError(409, 'A Mini Classificatoria ja possui confrontos gerados.');
  }

  const registrationsSnapshot = await db
    .collection('qualifierRegistrations')
    .where('seasonId', '==', seasonId)
    .where('category', '==', category)
    .where('status', '==', 'confirmed')
    .get();

  const sourceRegistrations = registrationsSnapshot.docs
    .map((doc): SourceRegistration | null => {
      const data = doc.data();
      if (data.format === 'mini_knockout' || data.eventId) return null;
      if (typeof data.userId !== 'string') return null;
      const region = data.region as BrazilState;
      if (!region) return null;
      return {
        id: doc.id,
        userId: data.userId,
        region,
        category,
        paymentId: typeof data.paymentId === 'string' ? data.paymentId : null,
        entryFeeCents: getNonNegativeInteger(data.entryFeeCents, 400),
        platformFeePercent: getNonNegativeInteger(data.platformFeePercent, PLATFORM_FEE_PERCENT),
        prizePoolPercent: getNonNegativeInteger(data.prizePoolPercent, PRIZE_POOL_PERCENT),
        createdAt: data.createdAt,
      };
    })
    .filter((registration): registration is SourceRegistration => Boolean(registration))
    .sort(
      (a, b) => getMillis(a.createdAt) - getMillis(b.createdAt) || a.userId.localeCompare(b.userId),
    );

  if (sourceRegistrations.length === 0) {
    throw new ApiError(400, 'Nao ha inscricoes pagas para migrar para a Mini Classificatoria.');
  }

  const totalEntryCents = sourceRegistrations.reduce(
    (total, registration) => total + registration.entryFeeCents,
    0,
  );
  const prizePoolCents = Math.floor(totalEntryCents * (PRIZE_POOL_PERCENT / 100));
  const platformFeeCents = totalEntryCents - prizePoolCents;
  const userDocs = await Promise.all(
    sourceRegistrations.map((registration) => db.collection('users').doc(registration.userId).get()),
  );
  const userById = new Map(userDocs.map((doc) => [doc.id, doc.data() ?? {}]));
  const miniRegistrations = sourceRegistrations.map((registration) => ({
    ...registration,
    miniRegistrationId: `${eventId}-${registration.id}`,
    sourceTrackId: getQualifierTrackId(registration.region, category),
  }));
  const generation = buildInitialQualifierMatchPlans({
    entrants: miniRegistrations.map((registration) => ({
      userId: registration.userId,
      registrationId: registration.miniRegistrationId,
    })),
    seasonId,
    category,
    region: MINI_BRACKET_PLAN_REGION,
    startsAt: bracketStart,
    maxQualified: 1,
  });
  const matchIdsByRegistration = new Map<string, string>();
  const batch = db.batch();
  const trackRef = db.collection('qualifierTracks').doc(trackId);

  generation.matchDocs.forEach((matchDoc) => {
    const matchRef = db.collection('qualifierMatches').doc();
    matchDoc.registrationIds.forEach((registrationId) => {
      matchIdsByRegistration.set(registrationId, matchRef.id);
    });
    batch.set(matchRef, {
      id: matchRef.id,
      ...matchDoc,
      scope: 'national',
      region: null,
      format: 'mini_knockout',
      eventId,
      scheduledFor: Timestamp.fromDate(matchDoc.scheduledFor as Date),
      submissionDeadline: Timestamp.fromDate(matchDoc.submissionDeadline as Date),
      votingStart: Timestamp.fromDate(matchDoc.votingStart as Date),
      votingEnd: Timestamp.fromDate(matchDoc.votingEnd as Date),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  for (const registration of miniRegistrations) {
    const matchId = matchIdsByRegistration.get(registration.miniRegistrationId);
    const hasBye = !matchId;
    const user = userById.get(registration.userId) ?? {};
    const seasonKey = String(QUALIFIER_SEASON_YEAR);
    const categoryPoints = user.seasonCategoryPoints?.[seasonKey]?.[category];

    batch.set(db.collection('qualifierRegistrations').doc(registration.miniRegistrationId), {
      id: registration.miniRegistrationId,
      userId: registration.userId,
      seasonId,
      category,
      scope: 'national',
      region: null,
      originalRegion: registration.region,
      format: 'mini_knockout',
      eventId,
      sourceRegistrationId: registration.id,
      sourceTrackId: registration.sourceTrackId,
      status: 'confirmed',
      bracketStatus: hasBye ? 'waiting_draw' : 'active',
      currentRound: hasBye ? 2 : 1,
      currentMatchId: matchId ?? null,
      matchIds: matchId ? [matchId] : [],
      qualifiedChampionshipId: null,
      entryFeeCents: registration.entryFeeCents,
      platformFeePercent: registration.platformFeePercent,
      prizePoolPercent: registration.prizePoolPercent,
      paymentId: registration.paymentId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(db.collection('qualifierRegistrations').doc(registration.id), {
      status: 'migrated_to_mini',
      bracketStatus: 'registered',
      currentRound: 0,
      currentMatchId: null,
      migratedToEventId: eventId,
      migratedToRegistrationId: registration.miniRegistrationId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('qualifierTickets').doc(`ticket-${registration.id}`), {
      id: `ticket-${registration.id}`,
      userId: registration.userId,
      sourceRegistrationId: registration.id,
      sourcePaymentId: registration.paymentId,
      sourceTrackId: registration.sourceTrackId,
      seasonId,
      category,
      region: registration.region,
      kind: 'state_qualifier_entry',
      status: 'available',
      reservedRegistrationId: null,
      usedRegistrationId: null,
      issuedReason: 'state_qualifier_postponed',
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      db.collection('qualifierParticipants').doc(registration.miniRegistrationId),
      {
        userId: registration.userId,
        seasonId,
        seasonYear: QUALIFIER_SEASON_YEAR,
        category,
        scope: 'national',
        region: null,
        originalRegion: registration.region,
        format: 'mini_knockout',
        eventId,
        displayName:
          typeof user.displayName === 'string' && user.displayName.trim()
            ? user.displayName
            : 'Participante',
        rank: categoryPoints?.rank ?? 'Iniciante',
        points: categoryPoints?.points ?? 0,
        confirmedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const sourceTrackIds = Array.from(
    new Set(miniRegistrations.map((registration) => registration.sourceTrackId)),
  );
  sourceTrackIds.forEach((sourceTrackId) => {
    batch.set(
      db.collection('qualifierTracks').doc(sourceTrackId),
      {
        status: 'postponed',
        postponedAt: FieldValue.serverTimestamp(),
        postponedReason: 'state_qualifier_postponed_for_mini_knockout',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  batch.set(
    trackRef,
    {
      id: trackId,
      slug: getMiniQualifierTrackSlug(category),
      seasonId,
      seasonYear: QUALIFIER_SEASON_YEAR,
      category,
      scope: 'national',
      region: null,
      format: 'mini_knockout',
      eventId,
      title: getMiniQualifierTrackTitle(category),
      status: generation.matchDocs.length > 0 ? 'active' : 'finished',
      entryFeeCents: 400,
      registrationDeadline: Timestamp.fromDate(registrationDeadline),
      bracketStart: Timestamp.fromDate(bracketStart),
      bracketEnd: Timestamp.fromDate(bracketEnd),
      maxQualified: 1,
      dailyMatchLimit: generation.bracketPlan.dailyMatchLimit,
      plannedMatchDays: generation.bracketPlan.totalMatchDays,
      plannedMatchCount: generation.bracketPlan.totalMatchCount,
      currentRound: generation.matchDocs.length > 0 ? 1 : 0,
      registeredCount: sourceRegistrations.length,
      confirmedCount: sourceRegistrations.length,
      pendingPaymentCount: 0,
      prizePoolCents,
      platformFeeCents,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  return {
    eventId,
    trackId,
    participantCount: sourceRegistrations.length,
    ticketCount: sourceRegistrations.length,
    postponedTrackCount: sourceTrackIds.length,
    matchCount: generation.matchDocs.length,
    byeCount: generation.byeEntrants.length,
    plannedMatchDays: generation.bracketPlan.totalMatchDays,
    prizePoolCents,
    platformFeeCents,
    status: generation.matchDocs.length > 0 ? ('active' as const) : ('finished' as const),
  };
}

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem migrar Classificatorias.');
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

function getNonNegativeInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}
