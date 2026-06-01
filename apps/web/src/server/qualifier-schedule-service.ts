import { FieldValue, Timestamp, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import type { BrazilState, CompetitionCategory, QualifierMatch } from '@batalha/types';
import { ApiError } from './api-errors';
import { getQualifierMatchDates } from '../lib/qualifier-bracket';
import { getQualifierTrackId, QUALIFIER_SEASON_ID } from '../lib/qualifier-tracks';

export interface UpdateQualifierScheduleInput {
  adminUserId: string;
  region: BrazilState;
  category: CompetitionCategory;
  registrationDeadline: Date;
  bracketStart: Date;
  bracketEnd: Date;
  seasonId?: string;
  rescheduleMatches?: boolean;
}

export interface UpdateAllQualifierSchedulesInput {
  adminUserId: string;
  registrationDeadline: Date;
  bracketStart: Date;
  bracketEnd: Date;
  seasonId?: string;
  rescheduleMatches?: boolean;
}

const RESCHEDULABLE_MATCH_STATUSES = new Set<QualifierMatch['status']>([
  'scheduled',
  'submissions_open',
]);

export async function updateQualifierSchedule(
  db: Firestore,
  {
    adminUserId,
    region,
    category,
    registrationDeadline,
    bracketStart,
    bracketEnd,
    seasonId = QUALIFIER_SEASON_ID,
    rescheduleMatches = true,
  }: UpdateQualifierScheduleInput,
) {
  await requireAdmin(db, adminUserId);
  validateScheduleDates({ registrationDeadline, bracketStart, bracketEnd });

  const trackRef = db.collection('qualifierTracks').doc(getQualifierTrackId(region, category));
  const trackDoc = await trackRef.get();
  if (!trackDoc.exists) throw new ApiError(404, 'Classificatoria nao encontrada');

  const batch = db.batch();
  batch.set(
    trackRef,
    {
      registrationDeadline: Timestamp.fromDate(registrationDeadline),
      bracketStart: Timestamp.fromDate(bracketStart),
      bracketEnd: Timestamp.fromDate(bracketEnd),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  let rescheduledMatchCount = 0;

  if (rescheduleMatches) {
    const matches = await db
      .collection('qualifierMatches')
      .where('seasonId', '==', seasonId)
      .where('region', '==', region)
      .where('category', '==', category)
      .get();

    for (const matchDoc of matches.docs) {
      const match = matchDoc.data() as Partial<QualifierMatch>;
      if (!RESCHEDULABLE_MATCH_STATUSES.has(match.status as QualifierMatch['status'])) continue;

      const matchDayIndex = Number(match.matchDayIndex ?? 1);
      const dates = getQualifierMatchDates(bracketStart, matchDayIndex);
      batch.update(matchDoc.ref, {
        scheduledFor: Timestamp.fromDate(dates.scheduledFor),
        submissionDeadline: Timestamp.fromDate(dates.submissionDeadline),
        votingStart: Timestamp.fromDate(dates.votingStart),
        votingEnd: Timestamp.fromDate(dates.votingEnd),
        updatedAt: FieldValue.serverTimestamp(),
      });
      rescheduledMatchCount += 1;
    }
  }

  await batch.commit();

  return {
    trackId: trackRef.id,
    rescheduledMatchCount,
  };
}

export async function updateAllQualifierSchedules(
  db: Firestore,
  {
    adminUserId,
    registrationDeadline,
    bracketStart,
    bracketEnd,
    seasonId = QUALIFIER_SEASON_ID,
    rescheduleMatches = true,
  }: UpdateAllQualifierSchedulesInput,
) {
  await requireAdmin(db, adminUserId);
  validateScheduleDates({ registrationDeadline, bracketStart, bracketEnd });

  const tracks = await db.collection('qualifierTracks').where('seasonId', '==', seasonId).get();
  if (tracks.empty) throw new ApiError(404, 'Nenhuma Classificatoria encontrada');

  const writes: Array<(batch: WriteBatch) => void> = [];
  const scheduleFields = {
    registrationDeadline: Timestamp.fromDate(registrationDeadline),
    bracketStart: Timestamp.fromDate(bracketStart),
    bracketEnd: Timestamp.fromDate(bracketEnd),
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const trackDoc of tracks.docs) {
    writes.push((batch) => batch.set(trackDoc.ref, scheduleFields, { merge: true }));
  }

  let rescheduledMatchCount = 0;

  if (rescheduleMatches) {
    const matches = await db
      .collection('qualifierMatches')
      .where('seasonId', '==', seasonId)
      .get();

    for (const matchDoc of matches.docs) {
      const match = matchDoc.data() as Partial<QualifierMatch>;
      if (!RESCHEDULABLE_MATCH_STATUSES.has(match.status as QualifierMatch['status'])) continue;

      const matchDayIndex = Number(match.matchDayIndex ?? 1);
      const dates = getQualifierMatchDates(bracketStart, matchDayIndex);
      writes.push((batch) =>
        batch.update(matchDoc.ref, {
          scheduledFor: Timestamp.fromDate(dates.scheduledFor),
          submissionDeadline: Timestamp.fromDate(dates.submissionDeadline),
          votingStart: Timestamp.fromDate(dates.votingStart),
          votingEnd: Timestamp.fromDate(dates.votingEnd),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
      rescheduledMatchCount += 1;
    }
  }

  await commitInChunks(db, writes);

  return {
    trackCount: tracks.docs.length,
    rescheduledMatchCount,
  };
}

export function validateScheduleDates({
  registrationDeadline,
  bracketStart,
  bracketEnd,
}: Pick<UpdateQualifierScheduleInput, 'registrationDeadline' | 'bracketStart' | 'bracketEnd'>) {
  if ([registrationDeadline, bracketStart, bracketEnd].some((date) => Number.isNaN(date.getTime()))) {
    throw new ApiError(400, 'Informe datas validas.');
  }

  if (registrationDeadline > bracketStart) {
    throw new ApiError(400, 'O fim das inscricoes precisa ser antes do inicio dos envios.');
  }

  if (bracketEnd < bracketStart) {
    throw new ApiError(400, 'O fim dos envios precisa ser depois do inicio dos envios.');
  }
}

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem atualizar Classificatorias.');
  }
}

async function commitInChunks(
  db: Firestore,
  writes: Array<(batch: WriteBatch) => void>,
) {
  const chunkSize = 450;
  for (let index = 0; index < writes.length; index += chunkSize) {
    const batch = db.batch();
    writes.slice(index, index + chunkSize).forEach((write) => write(batch));
    await batch.commit();
  }
}
