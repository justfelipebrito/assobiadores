import { describe, expect, it } from 'vitest';
import { qualifierTrackToScheduleValues, validateQualifierScheduleValues } from './qualifier-schedule-form';

describe('qualifier schedule admin form', () => {
  it('maps track timestamps to datetime-local fields', () => {
    expect(
      qualifierTrackToScheduleValues({
        registrationDeadline: { seconds: 1780239599 },
        bracketStart: { seconds: 1780243200 },
        bracketEnd: { seconds: 1783871999 },
      } as never),
    ).toMatchObject({
      registrationDeadline: expect.stringMatching(/^2026-0[56]-/),
      submissionStart: expect.stringMatching(/^2026-0[56]-/),
      submissionEnd: expect.stringMatching(/^2026-07-/),
    });
  });

  it('builds the trusted schedule payload when dates are ordered', () => {
    const result = validateQualifierScheduleValues({
      track: { region: 'SP', category: 'freestyle' },
      values: {
        registrationDeadline: '2026-05-31T23:59',
        submissionStart: '2026-06-01T00:00',
        submissionEnd: '2026-07-12T23:59',
      },
    });

    expect(result.error).toBeNull();
    expect(result.payload).toMatchObject({
      scope: 'track',
      region: 'SP',
      category: 'freestyle',
      registrationDeadline: expect.stringContaining('2026-'),
      bracketStart: expect.stringContaining('2026-'),
      bracketEnd: expect.stringContaining('2026-'),
    });
  });

  it('builds a global schedule payload without a track', () => {
    const result = validateQualifierScheduleValues({
      values: {
        registrationDeadline: '2026-05-31T23:59',
        submissionStart: '2026-06-01T00:00',
        submissionEnd: '2026-07-12T23:59',
      },
    });

    expect(result.error).toBeNull();
    expect(result.payload).toMatchObject({
      scope: 'all',
      registrationDeadline: expect.stringContaining('2026-'),
      bracketStart: expect.stringContaining('2026-'),
      bracketEnd: expect.stringContaining('2026-'),
    });
    expect(result.payload).not.toHaveProperty('region');
    expect(result.payload).not.toHaveProperty('category');
  });

  it('rejects missing, invalid, and out-of-order dates', () => {
    expect(
      validateQualifierScheduleValues({
        track: { region: 'SP', category: 'freestyle' },
        values: { registrationDeadline: '', submissionStart: '', submissionEnd: '' },
      }).error,
    ).toBe('Informe todas as datas da Classificatoria.');

    expect(
      validateQualifierScheduleValues({
        track: { region: 'SP', category: 'freestyle' },
        values: {
          registrationDeadline: '2026-06-02T00:00',
          submissionStart: '2026-06-01T00:00',
          submissionEnd: '2026-07-12T23:59',
        },
      }).error,
    ).toBe('O fim das inscricoes precisa ser antes do inicio dos envios.');

    expect(
      validateQualifierScheduleValues({
        track: { region: 'SP', category: 'freestyle' },
        values: {
          registrationDeadline: '2026-05-31T23:59',
          submissionStart: '2026-07-13T00:00',
          submissionEnd: '2026-07-12T23:59',
        },
      }).error,
    ).toBe('O fim dos envios precisa ser depois do inicio dos envios.');
  });
});
