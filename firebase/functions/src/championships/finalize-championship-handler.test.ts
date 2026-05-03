import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeChampionshipHandler } from './finalize-championship-handler';
import { POINTS_TABLE } from '../domain/ranking';

const serverTimestamp = Symbol('serverTimestamp');
const fieldValue = {
  serverTimestamp: vi.fn(() => serverTimestamp),
  increment: vi.fn((n: number) => ({ _increment: n })),
};
const logger = { info: vi.fn() };

const CHAMP_MULTIPLIER = 2;

function buildDb({
  champData,
  stagesDocs = [],
  matchesByStage = {},
  userPoints = {},
}: {
  champData: Record<string, unknown> | null;
  stagesDocs?: Array<{ id: string; data: Record<string, unknown> }>;
  matchesByStage?: Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
  userPoints?: Record<string, number>;
}) {
  const batch = { update: vi.fn(), commit: vi.fn() };
  const userRefs: Record<string, object> = {};

  const champRef = {
    get: vi.fn(async () => ({
      exists: champData !== null,
      data: () => champData ?? undefined,
    })),
    collection: vi.fn((name: string) => {
      if (name === 'stages') {
        return {
          get: vi.fn(async () => ({
            docs: stagesDocs.map((s) => ({
              id: s.id,
              data: () => s.data,
              ref: {
                collection: vi.fn(() => ({
                  get: vi.fn(async () => ({
                    docs: (matchesByStage[s.id] ?? []).map((m) => ({
                      id: m.id,
                      data: () => m.data,
                      ref: {},
                    })),
                  })),
                })),
              },
            })),
          })),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'championships') {
        return { doc: vi.fn(() => champRef) };
      }
      if (name === 'users') {
        return {
          doc: vi.fn((uid: string) => {
            if (!userRefs[uid]) {
              userRefs[uid] = { id: uid };
            }
            return {
              get: vi.fn(async () => ({
                data: () => ({ points: userPoints[uid] ?? 0 }),
              })),
              ...userRefs[uid],
            };
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
    batch: vi.fn(() => batch),
  } as unknown;

  return { db, batch };
}

describe('finalizeChampionshipHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws if championship does not exist', async () => {
    const { db } = buildDb({ champData: null });
    await expect(
      finalizeChampionshipHandler('c1', {
        db: db as never,
        fieldValue: fieldValue as never,
        logger,
      }),
    ).rejects.toThrow('not found');
  });

  it('throws if championship is already finished', async () => {
    const { db } = buildDb({ champData: { status: 'finished', prizeDistribution: null } });
    await expect(
      finalizeChampionshipHandler('c1', {
        db: db as never,
        fieldValue: fieldValue as never,
        logger,
      }),
    ).rejects.toThrow('already finished');
  });

  it('throws if any stage is still active', async () => {
    const { db } = buildDb({
      champData: { status: 'active', prizeDistribution: null },
      stagesDocs: [
        { id: 's1', data: { name: 'Semifinal', status: 'finished' } },
        { id: 's2', data: { name: 'Final', status: 'active' } },
      ],
      matchesByStage: {},
    });

    await expect(
      finalizeChampionshipHandler('c1', {
        db: db as never,
        fieldValue: fieldValue as never,
        logger,
      }),
    ).rejects.toThrow('stage(s) still active');
  });

  it('determines champion from the Final stage winner', async () => {
    const { db, batch } = buildDb({
      champData: { status: 'active', prizeDistribution: null },
      stagesDocs: [{ id: 's1', data: { name: 'Final', status: 'finished' } }],
      matchesByStage: {
        s1: [
          {
            id: 'm1',
            data: {
              status: 'finished',
              winnerId: 'user-champion',
              participantIds: ['user-champion', 'user-runner'],
              updatedAt: { seconds: 1000 },
            },
          },
        ],
      },
      userPoints: { 'user-champion': 100, 'user-runner': 50 },
    });

    const result = await finalizeChampionshipHandler('c1', {
      db: db as never,
      fieldValue: fieldValue as never,
      logger,
    });

    expect(result.champion).toBe('user-champion');
    expect(result.winners).toHaveLength(2);
    expect(result.winners.find((w) => w.place === 1)?.userId).toBe('user-champion');
    expect(result.winners.find((w) => w.place === 2)?.userId).toBe('user-runner');
  });

  it('awards 2x points to all participants', async () => {
    const { db, batch } = buildDb({
      champData: { status: 'active', prizeDistribution: null },
      stagesDocs: [{ id: 's1', data: { name: 'Final', status: 'finished' } }],
      matchesByStage: {
        s1: [
          {
            id: 'm1',
            data: {
              status: 'finished',
              winnerId: 'user-a',
              participantIds: ['user-a', 'user-b'],
              updatedAt: { seconds: 1000 },
            },
          },
        ],
      },
      userPoints: { 'user-a': 0, 'user-b': 0 },
    });

    await finalizeChampionshipHandler('c1', {
      db: db as never,
      fieldValue: fieldValue as never,
      logger,
    });

    // Champion (place 1) should get POINTS_TABLE.first * 2
    const expectedChampionPoints = POINTS_TABLE.first * CHAMP_MULTIPLIER;
    // Runner-up (place 2) should get POINTS_TABLE.second * 2
    const expectedRunnerPoints = POINTS_TABLE.second * CHAMP_MULTIPLIER;

    const userUpdates = batch.update.mock.calls.filter(
      ([ref]: [{ id?: string }]) => ref.id === 'user-a' || ref.id === 'user-b',
    );

    const champUpdate = userUpdates.find(([ref]: [{ id?: string }]) => ref.id === 'user-a')?.[1];
    const runnerUpdate = userUpdates.find(([ref]: [{ id?: string }]) => ref.id === 'user-b')?.[1];

    expect(champUpdate?.points).toEqual({ _increment: expectedChampionPoints });
    expect(runnerUpdate?.points).toEqual({ _increment: expectedRunnerPoints });
  });

  it('awards participation points (2x) to non-placing participants', async () => {
    const { db, batch } = buildDb({
      champData: { status: 'active', prizeDistribution: null },
      stagesDocs: [
        { id: 'group', data: { name: 'Fase de Grupos', status: 'finished' } },
        { id: 'final', data: { name: 'Final', status: 'finished' } },
      ],
      matchesByStage: {
        group: [
          {
            id: 'gm1',
            data: {
              status: 'finished',
              winnerId: 'user-a',
              participantIds: ['user-a', 'user-knocked-out'],
              updatedAt: { seconds: 500 },
            },
          },
        ],
        final: [
          {
            id: 'fm1',
            data: {
              status: 'finished',
              winnerId: 'user-a',
              participantIds: ['user-a', 'user-b'],
              updatedAt: { seconds: 1000 },
            },
          },
        ],
      },
      userPoints: { 'user-a': 0, 'user-b': 0, 'user-knocked-out': 0 },
    });

    const result = await finalizeChampionshipHandler('c1', {
      db: db as never,
      fieldValue: fieldValue as never,
      logger,
    });

    expect(result.participantCount).toBe(3);

    const knockedOutUpdate = batch.update.mock.calls.find(
      ([ref]: [{ id?: string }]) => ref.id === 'user-knocked-out',
    )?.[1];

    expect(knockedOutUpdate?.points).toEqual({
      _increment: POINTS_TABLE.participation * CHAMP_MULTIPLIER,
    });
  });

  it('writes season-scoped points when championship has a season', async () => {
    const { db, batch } = buildDb({
      champData: {
        status: 'active',
        seasonId: '2026',
        category: 'freestyle',
        prizeDistribution: null,
      },
      stagesDocs: [{ id: 's1', data: { name: 'Final', status: 'finished' } }],
      matchesByStage: {
        s1: [
          {
            id: 'm1',
            data: {
              status: 'finished',
              winnerId: 'user-a',
              participantIds: ['user-a', 'user-b'],
              updatedAt: { seconds: 1000 },
            },
          },
        ],
      },
      userPoints: { 'user-a': 0, 'user-b': 0 },
    });

    await finalizeChampionshipHandler('c1', {
      db: db as never,
      fieldValue: fieldValue as never,
      logger,
    });

    const champUpdate = batch.update.mock.calls.find(
      ([ref]: [{ id?: string }]) => ref.id === 'user-a',
    )?.[1];

    expect(champUpdate).toMatchObject({
      'seasonPoints.2026.points': { _increment: POINTS_TABLE.first * CHAMP_MULTIPLIER },
      'seasonPoints.2026.xp': { _increment: POINTS_TABLE.first * CHAMP_MULTIPLIER },
      'seasonPoints.2026.rank': 'Assobiador',
      'seasonPoints.2026.updatedAt': serverTimestamp,
      'seasonCategoryPoints.2026.freestyle.points': {
        _increment: POINTS_TABLE.first * CHAMP_MULTIPLIER,
      },
      'seasonCategoryPoints.2026.freestyle.xp': {
        _increment: POINTS_TABLE.first * CHAMP_MULTIPLIER,
      },
      'seasonCategoryPoints.2026.freestyle.rank': 'Assobiador',
      'seasonCategoryPoints.2026.freestyle.updatedAt': serverTimestamp,
    });
  });

  it('marks championship as finished with winners in batch', async () => {
    const { db, batch } = buildDb({
      champData: { status: 'active', prizeDistribution: null },
      stagesDocs: [{ id: 's1', data: { name: 'Final', status: 'finished' } }],
      matchesByStage: {
        s1: [
          {
            id: 'm1',
            data: {
              status: 'finished',
              winnerId: 'user-a',
              participantIds: ['user-a', 'user-b'],
              updatedAt: { seconds: 1000 },
            },
          },
        ],
      },
      userPoints: { 'user-a': 0, 'user-b': 0 },
    });

    await finalizeChampionshipHandler('c1', {
      db: db as never,
      fieldValue: fieldValue as never,
      logger,
    });

    const champUpdate = batch.update.mock.calls.find(
      ([ref]: [{ id?: string }]) => !ref.id || ref.id === 'c1',
    );
    expect(champUpdate?.[1]).toMatchObject({ status: 'finished' });
    expect(batch.commit).toHaveBeenCalledOnce();
  });
});
