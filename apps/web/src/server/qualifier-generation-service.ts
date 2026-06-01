import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { BrazilState, CompetitionCategory } from '@batalha/types';
import { ApiError } from './api-errors';
import { buildInitialQualifierMatchPlans } from '../lib/qualifier-bracket';
import { getQualifierTrackId, QUALIFIER_SEASON_ID } from '../lib/qualifier-tracks';

const QUALIFIER_BRACKET_START = new Date('2026-06-01T00:00:00-03:00');

interface ConfirmedRegistration {
  id: string;
  userId: string;
  createdAt?: unknown;
}

export interface GenerateQualifierBracketInput {
  adminUserId: string;
  region: BrazilState;
  category: CompetitionCategory;
  seasonId?: string;
}

export async function generateQualifierBracket(
  db: Firestore,
  { adminUserId, region, category, seasonId = QUALIFIER_SEASON_ID }: GenerateQualifierBracketInput,
) {
  await requireAdmin(db, adminUserId);

  const existingMatches = await db
    .collection('qualifierMatches')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .limit(1)
    .get();

  if (!existingMatches.empty) {
    throw new ApiError(409, 'Esta chave ja foi gerada para a Classificatoria.');
  }

  const trackRef = db.collection('qualifierTracks').doc(getQualifierTrackId(region, category));
  const trackDoc = await trackRef.get();
  const bracketStart = getDate(trackDoc.data()?.bracketStart) ?? QUALIFIER_BRACKET_START;

  const registrationsSnapshot = await db
    .collection('qualifierRegistrations')
    .where('seasonId', '==', seasonId)
    .where('region', '==', region)
    .where('category', '==', category)
    .where('status', '==', 'confirmed')
    .get();

  const registrations = registrationsSnapshot.docs
    .map((doc): ConfirmedRegistration | null => {
      const data = doc.data();
      if (typeof data.userId !== 'string') return null;
      return { id: doc.id, userId: data.userId, createdAt: data.createdAt };
    })
    .filter((registration): registration is ConfirmedRegistration => Boolean(registration))
    .sort(
      (a, b) => getMillis(a.createdAt) - getMillis(b.createdAt) || a.userId.localeCompare(b.userId),
    );

  if (registrations.length === 0) {
    throw new ApiError(400, 'Nao ha inscricoes confirmadas para gerar a chave.');
  }

  const entrants = registrations.map((registration) => ({
    userId: registration.userId,
    registrationId: registration.id,
  }));
  const generation = buildInitialQualifierMatchPlans({
    entrants,
    seasonId,
    category,
    region,
    startsAt: bracketStart,
  });
  const batch = db.batch();

  if (generation.bracketPlan.qualifiedWithoutMatches) {
    registrations.forEach((registration) => {
      batch.update(db.collection('qualifierRegistrations').doc(registration.id), {
        bracketStatus: 'qualified',
        currentRound: 0,
        currentMatchId: null,
        matchIds: [],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    batch.set(
      trackRef,
      {
        status: 'finished',
        dailyMatchLimit: generation.bracketPlan.dailyMatchLimit,
        plannedMatchDays: 0,
        plannedMatchCount: 0,
        currentRound: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await batch.commit();

    return {
      participantCount: registrations.length,
      matchCount: 0,
      byeCount: registrations.length,
      dailyMatchLimit: generation.bracketPlan.dailyMatchLimit,
      plannedMatchDays: 0,
      status: 'finished' as const,
    };
  }

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

  registrations.forEach((registration) => {
    const matchId = matchIdsByRegistration.get(registration.id);
    const hasBye = !matchId;
    batch.update(db.collection('qualifierRegistrations').doc(registration.id), {
      bracketStatus: hasBye ? 'waiting_draw' : 'active',
      currentRound: hasBye ? 2 : 1,
      currentMatchId: matchId ?? null,
      matchIds: matchId ? FieldValue.arrayUnion(matchId) : [],
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  batch.set(
    trackRef,
    {
      status: 'active',
      dailyMatchLimit: generation.bracketPlan.dailyMatchLimit,
      plannedMatchDays: generation.bracketPlan.totalMatchDays,
      plannedMatchCount: generation.bracketPlan.totalMatchCount,
      currentRound: 1,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  return {
    participantCount: registrations.length,
    matchCount: generation.matchPlans.length,
    byeCount: generation.byeEntrants.length,
    dailyMatchLimit: generation.bracketPlan.dailyMatchLimit,
    plannedMatchDays: generation.bracketPlan.totalMatchDays,
    status: 'active' as const,
  };
}

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem gerar chaves.');
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
