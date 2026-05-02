import { describe, expect, it, vi } from 'vitest';
import { finalizeBattleHandler, shouldAwardOfficialBattlePoints } from './finalize-handler';

class TestHttpsError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const fieldValue = {
  increment: (value: number) => ({ _increment: value }),
  serverTimestamp: () => ({ _serverTimestamp: true }),
};

function createQuery(docs: Array<Record<string, unknown>>) {
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    get: vi.fn(async () => ({
      empty: docs.length === 0,
      docs: docs.map((data, index) => ({
        id: `doc-${index}`,
        data: () => data,
      })),
    })),
  };
  return query;
}

function createDb({
  battle,
  submissions = [
    { userId: 'winner-1', voteCount: 5 },
    { userId: 'winner-2', voteCount: 3 },
  ],
  entries = [{ userId: 'winner-1' }, { userId: 'winner-2' }, { userId: 'participant-1' }],
  userPoints = {},
}: {
  battle: Record<string, unknown>;
  submissions?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
  userPoints?: Record<string, number>;
}) {
  const battleRef = { id: 'battle-1' };
  const userRefs = new Map<string, { id: string; get: ReturnType<typeof vi.fn> }>();
  const submissionsQuery = createQuery(submissions);
  const entriesQuery = createQuery(entries);
  const updates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
  const batch = {
    update: vi.fn((ref, data) => updates.push({ ref, data })),
    commit: vi.fn(async () => undefined),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') {
        return {
          doc: vi.fn(() => ({
            ...battleRef,
            get: vi.fn(async () => ({ exists: true, data: () => battle })),
          })),
        };
      }
      if (name === 'submissions') return submissionsQuery;
      if (name === 'battleEntries') return entriesQuery;
      if (name === 'users') {
        return {
          doc: vi.fn((userId: string) => {
            if (!userRefs.has(userId)) {
              userRefs.set(userId, {
                id: userId,
                get: vi.fn(async () => ({
                  exists: true,
                  data: () => ({ points: userPoints[userId] ?? 0 }),
                })),
              });
            }
            return userRefs.get(userId)!;
          }),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, updates, battleRef };
}

describe('finalizeBattleHandler', () => {
  it('identifies which battle types award official points', () => {
    expect(shouldAwardOfficialBattlePoints({ type: 'official' })).toBe(true);
    expect(shouldAwardOfficialBattlePoints({ type: 'community' })).toBe(false);
  });

  it('awards points and updates user ranks for official battles', async () => {
    const { db, updates } = createDb({
      battle: {
        type: 'official',
        status: 'voting',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
    });

    const result = await finalizeBattleHandler({
      db: db as never,
      battleId: 'battle-1',
      fieldValue,
      logger: { info: vi.fn() },
      HttpsError: TestHttpsError,
    });

    expect(result.officialScoringApplied).toBe(true);
    expect(result.winners[0]).toEqual({ userId: 'winner-1', place: 1, points: 100, prize: 1000 });
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'winner-1' }),
          data: expect.objectContaining({
            points: { _increment: 100 },
            xp: { _increment: 100 },
            rank: 'Aprendiz',
            'stats.battlesWon': { _increment: 1 },
          }),
        }),
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'participant-1' }),
          data: expect.objectContaining({
            points: { _increment: 10 },
            xp: { _increment: 10 },
          }),
        }),
      ]),
    );
  });

  it('finalizes community battles without official points or user ranking updates', async () => {
    const { db, updates, battleRef } = createDb({
      battle: {
        type: 'community',
        status: 'voting',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
    });

    const result = await finalizeBattleHandler({
      db: db as never,
      battleId: 'battle-1',
      fieldValue,
      logger: { info: vi.fn() },
      HttpsError: TestHttpsError,
    });

    expect(result.officialScoringApplied).toBe(false);
    expect(result.winners[0]).toEqual({ userId: 'winner-1', place: 1, points: 0, prize: 1000 });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      ref: expect.objectContaining(battleRef),
      data: expect.objectContaining({
        status: 'finished',
        officialScoringApplied: false,
      }),
    });
  });
});
