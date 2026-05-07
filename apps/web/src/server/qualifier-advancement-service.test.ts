import { describe, expect, it, vi } from 'vitest';
import { advanceQualifierRound } from './qualifier-advancement-service';

function docSnap(id: string, data: Record<string, unknown>, exists = true) {
  return { id, exists, data: () => data };
}

function querySnapshot(docs: Array<ReturnType<typeof docSnap>> = []) {
  return { empty: docs.length === 0, docs };
}

function queryFromSnapshots(snapshots: unknown[]) {
  const q = {
    where: vi.fn(() => q),
    limit: vi.fn(() => q),
    get: vi.fn(async () => snapshots.shift()),
  };
  return q;
}

function waitingRegistrations(count: number) {
  return Array.from({ length: count }, (_, index) =>
    docSnap(`registration-${index + 1}`, {
      userId: `user-${index + 1}`,
      status: 'confirmed',
      bracketStatus: 'waiting_draw',
      currentRound: 2,
      createdAt: { seconds: index + 1 },
    }),
  );
}

function finishedMatches(count: number) {
  return Array.from({ length: count }, (_, index) =>
    docSnap(`match-${index + 1}`, {
      status: 'finished',
      roundNumber: 1,
      matchDayIndex: Math.floor(index / 5) + 1,
    }),
  );
}

function createDb({
  adminRole = 'admin',
  track = {
    currentRound: 1,
    confirmedCount: 100,
    maxQualified: 64,
    dailyMatchLimit: 5,
  },
  currentRoundMatches = finishedMatches(36),
  nextRoundMatches = [],
  registrationDocs = waitingRegistrations(64),
}: {
  adminRole?: string;
  track?: Record<string, unknown>;
  currentRoundMatches?: Array<ReturnType<typeof docSnap>>;
  nextRoundMatches?: Array<ReturnType<typeof docSnap>>;
  registrationDocs?: Array<ReturnType<typeof docSnap>>;
} = {}) {
  let matchCounter = 100;
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  };
  const matchesQuery = queryFromSnapshots([
    querySnapshot(currentRoundMatches),
    querySnapshot(nextRoundMatches),
  ]);
  const registrationsQuery = queryFromSnapshots([querySnapshot(registrationDocs)]);
  const trackRef = {
    id: 'qualifier-sp-2026-freestyle',
    get: vi.fn(async () => docSnap('qualifier-sp-2026-freestyle', track)),
  };

  const db = {
    batch: vi.fn(() => batch),
    doc: vi.fn((path: string) => ({ id: path.split('/').at(-1) ?? path, path })),
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn(async () => docSnap(id, { role: adminRole })),
          })),
        };
      }
      if (name === 'qualifierTracks') return { doc: vi.fn(() => trackRef) };
      if (name === 'qualifierMatches') {
        return {
          where: matchesQuery.where,
          doc: vi.fn(() => {
            matchCounter += 1;
            return { id: `match-${matchCounter}` };
          }),
        };
      }
      if (name === 'qualifierRegistrations') {
        return {
          where: registrationsQuery.where,
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      if (name === 'qualifierParticipants') {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      if (name === 'championships') {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      if (name === 'pointActivities') {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, batch };
}

describe('advanceQualifierRound', () => {
  it('qualifies waiting entrants when the track reaches the Regional cut', async () => {
    const { db, batch } = createDb({ registrationDocs: waitingRegistrations(64) });

    await expect(
      advanceQualifierRound(db as never, {
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
      }),
    ).resolves.toEqual({
      status: 'finished',
      roundNumber: 1,
      qualifiedCount: 64,
      matchCount: 0,
      byeCount: 64,
      pointsAwardedPerQualified: 500,
    });

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-1' }),
      expect.objectContaining({
        bracketStatus: 'qualified',
        currentMatchId: null,
        qualifiedChampionshipId: 'championship-sp-2026-freestyle',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-1' }),
      expect.objectContaining({
        userId: 'user-1',
        bracketStatus: 'qualified',
        qualifiedChampionshipId: 'championship-sp-2026-freestyle',
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        points: expect.anything(),
        'seasonCategoryPoints.2026.freestyle.points': expect.anything(),
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-sp-2026-freestyle' }),
      expect.objectContaining({ status: 'finished', currentRound: 1 }),
      { merge: true },
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'championship-sp-2026-freestyle' }),
      expect.objectContaining({
        participantIds: expect.anything(),
        currentParticipants: 64,
        qualifierBattleIds: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'qualifier__registration-1__qualifier_regional_qualification__user-1',
      }),
      expect.objectContaining({
        userId: 'user-1',
        points: 500,
        reason: 'qualifier_regional_qualification',
        sourceType: 'qualifier',
        sourceId: 'registration-1',
        category: 'freestyle',
      }),
    );
  });

  it('creates the next round when more than 64 entrants are still alive', async () => {
    const { db, batch } = createDb({
      track: { currentRound: 1, confirmedCount: 500, maxQualified: 64, dailyMatchLimit: 12 },
      currentRoundMatches: finishedMatches(244),
      registrationDocs: waitingRegistrations(256),
    });

    await expect(
      advanceQualifierRound(db as never, {
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
      }),
    ).resolves.toMatchObject({
      status: 'active',
      roundNumber: 2,
      matchCount: 128,
      byeCount: 0,
    });

    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^match-/) }),
      expect.objectContaining({
        roundNumber: 2,
        matchDayIndex: 22,
        status: 'scheduled',
      }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-1' }),
      expect.objectContaining({ bracketStatus: 'active', currentRound: 2 }),
    );
  });

  it('blocks advancement until all matches are finished and prevents duplicate next rounds', async () => {
    await expect(
      advanceQualifierRound(
        createDb({
          currentRoundMatches: [docSnap('match-1', { status: 'voting', roundNumber: 1 })],
        }).db as never,
        { adminUserId: 'admin-1', region: 'SP', category: 'freestyle' },
      ),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      advanceQualifierRound(
        createDb({
          nextRoundMatches: [docSnap('match-next', { status: 'scheduled', roundNumber: 2 })],
        }).db as never,
        { adminUserId: 'admin-1', region: 'SP', category: 'freestyle' },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
