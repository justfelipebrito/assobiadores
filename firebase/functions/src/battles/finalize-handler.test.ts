import { describe, expect, it, vi } from 'vitest';
import {
  finalizeBattleHandler,
  getBattleScoringEligibility,
  shouldAwardOfficialBattlePoints,
} from './finalize-handler';

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
  const sets: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
  const batch = {
    set: vi.fn((ref, data) => sets.push({ ref, data })),
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
      if (name === 'pointActivities') {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, updates, sets, battleRef };
}

describe('finalizeBattleHandler', () => {
  it('identifies which battle types award official points', () => {
    expect(shouldAwardOfficialBattlePoints({ type: 'official', category: 'freestyle' })).toBe(true);
    expect(shouldAwardOfficialBattlePoints({ type: 'community', category: 'melodia' })).toBe(true);
    expect(shouldAwardOfficialBattlePoints({ type: 'community' })).toBe(false);
  });

  it('requires real competition signals before battle points can be awarded', () => {
    expect(
      getBattleScoringEligibility({
        battle: { format: 'duel', category: 'freestyle' },
        entries: [{ userId: 'a' }, { userId: 'b' }],
        submissions: [
          { userId: 'a', voteCount: 1 },
          { userId: 'b', voteCount: 0 },
        ],
      }),
    ).toMatchObject({ eligible: true, reason: null });

    expect(
      getBattleScoringEligibility({
        battle: { format: 'group', category: 'freestyle' },
        entries: [
          { userId: 'a' },
          { userId: 'b' },
          { userId: 'c' },
          { userId: 'd' },
          { userId: 'e' },
        ],
        submissions: [
          { userId: 'a', voteCount: 1 },
          { userId: 'b', voteCount: 0 },
          { userId: 'c', voteCount: 0 },
          { userId: 'd', voteCount: 0 },
        ],
      }),
    ).toMatchObject({ eligible: false, reason: 'not-enough-approved-submissions' });

    expect(
      getBattleScoringEligibility({
        battle: { format: 'duel', category: 'freestyle' },
        entries: [{ userId: 'a' }, { userId: 'b' }],
        submissions: [
          { userId: 'a', voteCount: 0 },
          { userId: 'b', voteCount: 0 },
        ],
      }),
    ).toMatchObject({ eligible: false, reason: 'no-public-votes' });
  });

  it('awards unified season/category points for 1v1 battle wins', async () => {
    const { db, updates, sets } = createDb({
      battle: {
        type: 'official',
        format: 'duel',
        category: 'freestyle',
        seasonId: '2026',
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
    expect(result.winners[0]).toEqual({ userId: 'winner-1', place: 1, points: 10, prize: 1000 });
    expect(result.winners).toHaveLength(1);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'winner-1' }),
          data: expect.objectContaining({
            points: { _increment: 10 },
            xp: { _increment: 10 },
            rank: 'Iniciante',
            'seasonPoints.2026.points': { _increment: 10 },
            'seasonPoints.2026.xp': { _increment: 10 },
            'seasonCategoryPoints.2026.freestyle.points': { _increment: 10 },
            'seasonCategoryPoints.2026.freestyle.xp': { _increment: 10 },
            'stats.battlesWon': { _increment: 1 },
          }),
        }),
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'participant-1' }),
          data: expect.objectContaining({
            'stats.battlesEntered': { _increment: 1 },
          }),
        }),
      ]),
    );
    expect(
      updates.find(({ ref }) => (ref as { id?: string }).id === 'participant-1')?.data,
    ).not.toHaveProperty('points');
    expect(sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'battle__battle-1__battle_win__winner-1' }),
          data: expect.objectContaining({
            userId: 'winner-1',
            points: 10,
            reason: 'battle_win',
            sourceType: 'battle',
            sourceId: 'battle-1',
            category: 'freestyle',
            seasonId: '2026',
          }),
        }),
      ]),
    );
  });

  it('finalizes tied 1v1 battles without awarding season points', async () => {
    const { db, updates, battleRef } = createDb({
      battle: {
        type: 'community',
        format: 'duel',
        category: 'freestyle',
        seasonId: '2026',
        status: 'voting',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'winner-1', voteCount: 3 },
        { userId: 'winner-2', voteCount: 3 },
      ],
      entries: [{ userId: 'winner-1' }, { userId: 'winner-2' }],
    });

    const result = await finalizeBattleHandler({
      db: db as never,
      battleId: 'battle-1',
      fieldValue,
      logger: { info: vi.fn() },
      HttpsError: TestHttpsError,
    });

    expect(result.officialScoringApplied).toBe(false);
    expect(result.winners).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      ref: expect.objectContaining(battleRef),
      data: expect.objectContaining({
        seasonScoringApplied: false,
        seasonScoringEligibility: {
          eligible: true,
          reason: 'unresolved-tie',
        },
      }),
    });
  });

  it('uses the creator vote only to break public-vote ties', async () => {
    const { db, updates } = createDb({
      battle: {
        type: 'community',
        format: 'group',
        category: 'melodia',
        seasonId: '2026',
        status: 'voting',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'winner-1', voteCount: 5, publicVoteCount: 5 },
        { userId: 'winner-2', voteCount: 5, publicVoteCount: 5, judgeVoteCount: 1 },
        { userId: 'participant-1', voteCount: 1, publicVoteCount: 1 },
        { userId: 'participant-2', voteCount: 0, publicVoteCount: 0 },
        { userId: 'participant-3', voteCount: 0, publicVoteCount: 0 },
      ],
      entries: [
        { userId: 'winner-1' },
        { userId: 'winner-2' },
        { userId: 'participant-1' },
        { userId: 'participant-2' },
        { userId: 'participant-3' },
      ],
    });

    const result = await finalizeBattleHandler({
      db: db as never,
      battleId: 'battle-1',
      fieldValue,
      logger: { info: vi.fn() },
      HttpsError: TestHttpsError,
    });

    expect(result.winners[0]).toEqual({ userId: 'winner-2', place: 1, points: 20, prize: 1000 });
    expect(
      updates.find(({ ref }) => (ref as { id?: string }).id === 'winner-2')?.data,
    ).toEqual(expect.objectContaining({ points: { _increment: 20 } }));
  });

  it('awards unified season/category points for community group battle wins', async () => {
    const { db, updates } = createDb({
      battle: {
        type: 'community',
        format: 'group',
        category: 'melodia',
        seasonId: '2026',
        status: 'voting',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'winner-1', voteCount: 5 },
        { userId: 'winner-2', voteCount: 3 },
        { userId: 'participant-1', voteCount: 1 },
        { userId: 'participant-2', voteCount: 0 },
        { userId: 'participant-3', voteCount: 0 },
      ],
      entries: [
        { userId: 'winner-1' },
        { userId: 'winner-2' },
        { userId: 'participant-1' },
        { userId: 'participant-2' },
        { userId: 'participant-3' },
      ],
    });

    const result = await finalizeBattleHandler({
      db: db as never,
      battleId: 'battle-1',
      fieldValue,
      logger: { info: vi.fn() },
      HttpsError: TestHttpsError,
    });

    expect(result.officialScoringApplied).toBe(true);
    expect(result.winners[0]).toEqual({ userId: 'winner-1', place: 1, points: 20, prize: 1000 });
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'winner-1' }),
          data: expect.objectContaining({
            points: { _increment: 20 },
            xp: { _increment: 20 },
            'seasonPoints.2026.points': { _increment: 20 },
            'seasonCategoryPoints.2026.melodia.points': { _increment: 20 },
          }),
        }),
      ]),
    );
  });

  it('finalizes community group battles without points when anti-farming eligibility fails', async () => {
    const { db, updates, battleRef } = createDb({
      battle: {
        type: 'community',
        format: 'group',
        category: 'melodia',
        seasonId: '2026',
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
        seasonScoringApplied: false,
        seasonScoringEligibility: {
          eligible: false,
          reason: 'not-enough-confirmed-participants',
        },
      }),
    });
  });

  it('finalizes battles without category without ranking updates', async () => {
    const { db, updates, battleRef } = createDb({
      battle: {
        type: 'community',
        format: 'group',
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
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      ref: expect.objectContaining(battleRef),
      data: expect.objectContaining({
        status: 'finished',
        officialScoringApplied: false,
        seasonScoringApplied: false,
        seasonScoringEligibility: {
          eligible: false,
          reason: 'missing-category',
        },
      }),
    });
  });
});
