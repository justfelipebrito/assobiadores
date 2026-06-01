import { describe, expect, it, vi } from 'vitest';
import { updateAllQualifierSchedules, updateQualifierSchedule } from './qualifier-schedule-service';

function createDb({
  admin = { role: 'admin' },
  trackExists = true,
  tracks = [
    { id: 'qualifier-sp-2026-freestyle' },
    { id: 'qualifier-rj-2026-melodia' },
  ],
  matches = [
    { id: 'match-1', status: 'scheduled', matchDayIndex: 1 },
    { id: 'match-2', status: 'voting', matchDayIndex: 2 },
    { id: 'match-3', status: 'submissions_open', matchDayIndex: 3 },
  ],
}: {
  admin?: Record<string, unknown>;
  trackExists?: boolean;
  tracks?: Array<Record<string, unknown> & { id: string }>;
  matches?: Array<Record<string, unknown> & { id: string }>;
} = {}) {
  const refs = new Map<string, { id: string }>();
  const ref = (id: string) => {
    if (!refs.has(id)) refs.set(id, { id });
    return refs.get(id)!;
  };
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined),
  };
  const matchesQuery = { where: vi.fn(() => matchesQuery) };
  const tracksQuery = { where: vi.fn(() => tracksQuery) };
  Object.assign(tracksQuery, {
    get: vi.fn(async () => ({
      empty: tracks.length === 0,
      docs: tracks.map((track) => ({
        id: track.id,
        ref: ref(track.id),
        data: () => track,
      })),
    })),
  });
  Object.assign(matchesQuery, {
    get: vi.fn(async () => ({
      docs: matches.map((match) => ({
        ref: ref(match.id),
        data: () => match,
      })),
    })),
  });
  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return { doc: vi.fn((id: string) => ({ get: vi.fn(async () => ({ exists: true, data: () => admin })), id })) };
      }
      if (name === 'qualifierTracks') {
        return {
          where: tracksQuery.where,
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn(async () => ({ exists: trackExists, data: () => ({ id }) })),
          })),
        };
      }
      if (name === 'qualifierMatches') return { where: matchesQuery.where };
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, batch, ref };
}

const validInput = {
  adminUserId: 'admin-1',
  region: 'SP' as const,
  category: 'freestyle' as const,
  registrationDeadline: new Date('2026-05-31T23:59:00-03:00'),
  bracketStart: new Date('2026-06-02T00:00:00-03:00'),
  bracketEnd: new Date('2026-07-12T23:59:00-03:00'),
};

describe('updateQualifierSchedule', () => {
  it('updates qualifier track dates and reschedules editable matches', async () => {
    const { db, batch, ref } = createDb();

    await expect(updateQualifierSchedule(db as never, validInput)).resolves.toEqual({
      trackId: 'qualifier-sp-2026-freestyle',
      rescheduledMatchCount: 2,
    });

    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-sp-2026-freestyle' }),
      expect.objectContaining({
        registrationDeadline: expect.anything(),
        bracketStart: expect.anything(),
        bracketEnd: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      ref('match-1'),
      expect.objectContaining({
        scheduledFor: expect.anything(),
        submissionDeadline: expect.anything(),
      }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      ref('match-3'),
      expect.objectContaining({
        scheduledFor: expect.anything(),
        submissionDeadline: expect.anything(),
      }),
    );
    expect(batch.update).not.toHaveBeenCalledWith(ref('match-2'), expect.anything());
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('blocks non-admin users and invalid date order', async () => {
    await expect(
      updateQualifierSchedule(createDb({ admin: { role: 'user' } }).db as never, validInput),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      updateQualifierSchedule(createDb().db as never, {
        ...validInput,
        registrationDeadline: new Date('2026-06-03T00:00:00-03:00'),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'O fim das inscricoes precisa ser antes do inicio dos envios.',
    });
  });

  it('returns not found for missing qualifier tracks', async () => {
    await expect(
      updateQualifierSchedule(createDb({ trackExists: false }).db as never, validInput),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateAllQualifierSchedules', () => {
  it('applies one schedule to every qualifier track and reschedules editable matches', async () => {
    const { db, batch, ref } = createDb();

    await expect(updateAllQualifierSchedules(db as never, validInput)).resolves.toEqual({
      trackCount: 2,
      rescheduledMatchCount: 2,
    });

    expect(batch.set).toHaveBeenCalledWith(
      ref('qualifier-sp-2026-freestyle'),
      expect.objectContaining({
        registrationDeadline: expect.anything(),
        bracketStart: expect.anything(),
        bracketEnd: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.set).toHaveBeenCalledWith(
      ref('qualifier-rj-2026-melodia'),
      expect.objectContaining({
        registrationDeadline: expect.anything(),
        bracketStart: expect.anything(),
        bracketEnd: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      ref('match-1'),
      expect.objectContaining({ submissionDeadline: expect.anything() }),
    );
    expect(batch.update).not.toHaveBeenCalledWith(ref('match-2'), expect.anything());
    expect(batch.update).toHaveBeenCalledWith(
      ref('match-3'),
      expect.objectContaining({ submissionDeadline: expect.anything() }),
    );
  });

  it('blocks non-admin users from global schedule changes', async () => {
    await expect(
      updateAllQualifierSchedules(createDb({ admin: { role: 'user' } }).db as never, validInput),
    ).rejects.toMatchObject({ status: 403 });
  });
});
