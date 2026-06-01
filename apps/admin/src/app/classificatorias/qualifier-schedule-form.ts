import type { CompetitionCategory, QualifierTrack } from '@batalha/types';

export interface AdminQualifierScheduleFormValues {
  registrationDeadline: string;
  submissionStart: string;
  submissionEnd: string;
}

export interface AdminQualifierSchedulePayload {
  scope: 'all' | 'track';
  region?: string;
  category?: CompetitionCategory;
  registrationDeadline: string;
  bracketStart: string;
  bracketEnd: string;
}

export interface AdminQualifierScheduleValidationResult {
  payload: AdminQualifierSchedulePayload | null;
  error: string | null;
}

export function toDatetimeLocalInput(value: unknown): string {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : typeof value === 'object' && value !== null && 'seconds' in value
        ? new Date(Number((value as { seconds: number }).seconds) * 1000)
        : typeof value === 'object' && value !== null && 'toDate' in value
          ? (value as { toDate: () => Date }).toDate()
          : null;

  if (!date || Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function qualifierTrackToScheduleValues(
  track: Pick<QualifierTrack, 'registrationDeadline' | 'bracketStart' | 'bracketEnd'>,
): AdminQualifierScheduleFormValues {
  return {
    registrationDeadline: toDatetimeLocalInput(track.registrationDeadline),
    submissionStart: toDatetimeLocalInput(track.bracketStart),
    submissionEnd: toDatetimeLocalInput(track.bracketEnd),
  };
}

export function validateQualifierScheduleValues({
  track,
  values,
}: {
  track?: Pick<QualifierTrack, 'region' | 'category'>;
  values: AdminQualifierScheduleFormValues;
}): AdminQualifierScheduleValidationResult {
  if (!values.registrationDeadline || !values.submissionStart || !values.submissionEnd) {
    return { payload: null, error: 'Informe todas as datas da Classificatoria.' };
  }

  const registrationDeadline = new Date(values.registrationDeadline);
  const bracketStart = new Date(values.submissionStart);
  const bracketEnd = new Date(values.submissionEnd);

  if ([registrationDeadline, bracketStart, bracketEnd].some((date) => Number.isNaN(date.getTime()))) {
    return { payload: null, error: 'Informe datas validas.' };
  }

  if (registrationDeadline > bracketStart) {
    return {
      payload: null,
      error: 'O fim das inscricoes precisa ser antes do inicio dos envios.',
    };
  }

  if (bracketEnd < bracketStart) {
    return {
      payload: null,
      error: 'O fim dos envios precisa ser depois do inicio dos envios.',
    };
  }

  return {
    payload: {
      scope: track ? 'track' : 'all',
      ...(track
        ? {
            region: track.region,
            category: track.category,
          }
        : {}),
      registrationDeadline: registrationDeadline.toISOString(),
      bracketStart: bracketStart.toISOString(),
      bracketEnd: bracketEnd.toISOString(),
    },
    error: null,
  };
}
