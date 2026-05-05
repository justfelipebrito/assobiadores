import { describe, expect, it, vi } from 'vitest';
import { finalizeBattle } from './battle-finalization-service';

function querySnapshot(docs: Array<{ data: () => Record<string, unknown> }> = []) {
  return { empty: docs.length === 0, docs };
}

function docSnap(data: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

function createQuery(snapshot: unknown) {
  const q = {
    where: vi.fn(() => q),
    orderBy: vi.fn(() => q),
    get: vi.fn(async () => snapshot),
  };
  return q;
}

function createDb({
  admin = { role: 'admin' },
  battle = {
    status: 'voting',
    category: 'freestyle',
    format: 'duel',
    createdBy: 'creator-1',
    prizeDistribution: { first: 1000, second: 500, third: 0 },
  },
  submissions = [
    { userId: 'user-a', status: 'approved', voteCount: 3 },
    { userId: 'user-b', status: 'approved', voteCount: 1 },
  ],
  entries = [
    { userId: 'user-a', status: 'confirmed' },
    { userId: 'user-b', status: 'confirmed' },
  ],
}: {
  admin?: Record<string, unknown>;
  battle?: Record<string, unknown>;
  submissions?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
} = {}) {
  const refs = new Map<string, { id: string; get?: () => Promise<unknown> }>();
  const ref = (id: string) => {
    if (!refs.has(id)) refs.set(id, { id });
    return refs.get(id)!;
  };
  const submissionsQuery = createQuery(
    querySnapshot(submissions.map((item) => ({ data: () => item }))),
  );
  const entriesQuery = createQuery(querySnapshot(entries.map((item) => ({ data: () => item }))));
  const batch = { update: vi.fn(), commit: vi.fn() };
  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn((id: string) => ({
            ...ref(id),
            get: vi.fn(async () => docSnap(id === 'admin-1' ? admin : { points: 0 })),
          })),
        };
      }
      if (name === 'battles') {
        return {
          doc: vi.fn(() => ({ ...ref('battle-1'), get: vi.fn(async () => docSnap(battle)) })),
        };
      }
      if (name === 'submissions') return { where: submissionsQuery.where };
      if (name === 'battleEntries') return { where: entriesQuery.where };
      throw new Error(`Unexpected collection ${name}`);
    }),
  };
  return { db, batch, ref };
}

describe('finalizeBattle', () => {
  it('finalizes a voting battle through the web admin service', async () => {
    const { db, batch } = createDb();

    await expect(
      finalizeBattle(db as never, { battleId: 'battle-1', actorUserId: 'creator-1' }),
    ).resolves.toMatchObject({
      success: true,
      officialScoringApplied: true,
      winners: [
        { userId: 'user-a', place: 1, points: 10, prize: 1000 },
        { userId: 'user-b', place: 2, points: 0, prize: 500 },
      ],
    });

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'battle-1' }),
      expect.objectContaining({
        status: 'finished',
        winners: expect.arrayContaining([expect.objectContaining({ userId: 'user-a' })]),
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not award points when a 1v1 battle ends tied', async () => {
    const { db, batch } = createDb({
      battle: {
        status: 'voting',
        category: 'freestyle',
        format: 'duel',
        createdBy: 'creator-1',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'user-a', status: 'approved', voteCount: 3 },
        { userId: 'user-b', status: 'approved', voteCount: 3 },
      ],
    });

    await expect(
      finalizeBattle(db as never, { battleId: 'battle-1', actorUserId: 'creator-1' }),
    ).resolves.toMatchObject({
      success: true,
      officialScoringApplied: false,
      winners: [
        { userId: 'user-a', place: 1, points: 0, prize: 1000 },
        { userId: 'user-b', place: 2, points: 0, prize: 500 },
      ],
    });

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'battle-1' }),
      expect.objectContaining({ seasonScoringApplied: false }),
    );
    expect(batch.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ points: expect.anything() }),
    );
  });

  it('uses community and creator judge weights to rank winners', async () => {
    const { db } = createDb({
      battle: {
        status: 'voting',
        category: 'freestyle',
        format: 'group',
        createdBy: 'creator-1',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'user-a', status: 'approved', voteCount: 5, publicVoteCount: 5 },
        {
          userId: 'user-b',
          status: 'approved',
          voteCount: 3,
          publicVoteCount: 2,
          judgeVoteCount: 1,
        },
        { userId: 'user-c', status: 'approved', voteCount: 1, publicVoteCount: 1 },
        { userId: 'user-d', status: 'approved', voteCount: 1, publicVoteCount: 1 },
        { userId: 'user-e', status: 'approved', voteCount: 1, publicVoteCount: 1 },
      ],
      entries: [
        { userId: 'user-a', status: 'confirmed' },
        { userId: 'user-b', status: 'confirmed' },
        { userId: 'user-c', status: 'confirmed' },
        { userId: 'user-d', status: 'confirmed' },
        { userId: 'user-e', status: 'confirmed' },
      ],
    });

    const result = await finalizeBattle(db as never, {
      battleId: 'battle-1',
      actorUserId: 'creator-1',
    });

    expect(result.winners[0]).toEqual({ userId: 'user-b', place: 1, points: 20, prize: 1000 });
    expect(result.winners[1]).toEqual({ userId: 'user-a', place: 2, points: 0, prize: 500 });
  });

  it('ignores approved submissions from users without confirmed entries when choosing winners', async () => {
    const { db } = createDb({
      battle: {
        status: 'voting',
        category: 'freestyle',
        format: 'duel',
        createdBy: 'creator-1',
        prizeDistribution: { first: 1000, second: 500, third: 0 },
      },
      submissions: [
        { userId: 'outsider', status: 'approved', voteCount: 99 },
        { userId: 'user-a', status: 'approved', voteCount: 3 },
        { userId: 'user-b', status: 'approved', voteCount: 1 },
      ],
      entries: [
        { userId: 'user-a', status: 'confirmed' },
        { userId: 'user-b', status: 'confirmed' },
      ],
    });

    const result = await finalizeBattle(db as never, {
      battleId: 'battle-1',
      actorUserId: 'creator-1',
    });

    expect(result.winners.map((winner) => winner.userId)).toEqual(['user-a', 'user-b']);
    expect(result.winners[0]).toMatchObject({ userId: 'user-a', points: 10 });
  });

  it('blocks non-admin and non-voting battle finalization', async () => {
    await expect(
      finalizeBattle(createDb({ admin: { role: 'user' } }).db as never, {
        battleId: 'battle-1',
        actorUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      finalizeBattle(createDb({ battle: { status: 'active' } }).db as never, {
        battleId: 'battle-1',
        actorUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
