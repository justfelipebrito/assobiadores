import { describe, expect, it, vi } from 'vitest';
import { resolveBattleTieBreak } from './battle-tiebreak-service';

function createQuery(key: string) {
  const query = {
    key,
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
  };
  return query;
}

function createDb({
  actor = { role: 'user' },
  battle = {
    status: 'voting',
    createdBy: 'creator-1',
    votingEnd: new Date('2026-05-01T00:00:00.000Z'),
  },
  submission = {
    id: 'submission-a',
    battleId: 'battle-1',
    status: 'approved',
    userId: 'user-a',
    voteCount: 3,
    publicVoteCount: 3,
  },
  submissions = [
    { id: 'submission-a', userId: 'user-a', status: 'approved', voteCount: 3, publicVoteCount: 3 },
    { id: 'submission-b', userId: 'user-b', status: 'approved', voteCount: 3, publicVoteCount: 3 },
  ],
  entries = [
    { userId: 'user-a', status: 'confirmed' },
    { userId: 'user-b', status: 'confirmed' },
  ],
  hasExistingTieBreak = false,
}: {
  actor?: Record<string, unknown>;
  battle?: Record<string, unknown>;
  submission?: Record<string, unknown>;
  submissions?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
  hasExistingTieBreak?: boolean;
} = {}) {
  const battleRef = { id: 'battle-1' };
  const submissionRef = { id: 'submission-a' };
  const actorRef = { id: 'creator-1' };
  const voteRef = { id: 'vote-1' };
  const votesQuery = createQuery('votes');
  const submissionsQuery = createQuery('submissions');
  const entriesQuery = createQuery('entries');
  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === battleRef) return { exists: true, data: () => battle };
      if (target === submissionRef) return { exists: true, data: () => submission };
      if (target === actorRef) return { exists: true, data: () => actor };
      if (target === votesQuery) return { empty: !hasExistingTieBreak };
      if (target === submissionsQuery) {
        return {
          docs: submissions.map((item) => ({
            id: String(item.id),
            data: () => item,
          })),
        };
      }
      if (target === entriesQuery) {
        return {
          docs: entries.map((item) => ({
            data: () => item,
          })),
        };
      }
      throw new Error('Unexpected transaction target');
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  const db = {
    runTransaction: vi.fn(async (callback) => callback(tx)),
    collection: vi.fn((name: string) => {
      if (name === 'battles') return { doc: vi.fn(() => battleRef) };
      if (name === 'users') return { doc: vi.fn(() => actorRef) };
      if (name === 'submissions') {
        return {
          doc: vi.fn(() => submissionRef),
          where: submissionsQuery.where,
        };
      }
      if (name === 'battleEntries') return { where: entriesQuery.where };
      if (name === 'votes') {
        return {
          doc: vi.fn(() => voteRef),
          where: votesQuery.where,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, tx, voteRef, submissionRef };
}

describe('resolveBattleTieBreak', () => {
  it('records a creator tie-break after voting ends for a top tied submission', async () => {
    const { db, tx, voteRef, submissionRef } = createDb();

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-a',
        actorUserId: 'creator-1',
        now: new Date('2026-05-01T00:01:00.000Z'),
      }),
    ).resolves.toEqual({ tieBreakVoteId: 'vote-1' });

    expect(tx.set).toHaveBeenCalledWith(
      voteRef,
      expect.objectContaining({
        battleId: 'battle-1',
        submissionId: 'submission-a',
        voterId: 'creator-1',
        voterType: 'judge',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      submissionRef,
      expect.objectContaining({ judgeVoteCount: expect.anything() }),
    );
  });

  it('allows admin tie-breaks', async () => {
    const { db } = createDb({ actor: { role: 'admin' } });

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-a',
        actorUserId: 'admin-1',
        now: new Date('2026-05-01T00:01:00.000Z'),
      }),
    ).resolves.toEqual({ tieBreakVoteId: 'vote-1' });
  });

  it('blocks tie-breaks before voting ends', async () => {
    const { db } = createDb();

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-a',
        actorUserId: 'creator-1',
        now: new Date('2026-04-30T23:59:00.000Z'),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Desempate liberado somente apos o fim da votacao',
    });
  });

  it('requires an unresolved top tie', async () => {
    const { db } = createDb({
      submissions: [
        { id: 'submission-a', userId: 'user-a', status: 'approved', voteCount: 4, publicVoteCount: 4 },
        { id: 'submission-b', userId: 'user-b', status: 'approved', voteCount: 3, publicVoteCount: 3 },
      ],
    });

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-a',
        actorUserId: 'creator-1',
        now: new Date('2026-05-01T00:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Nao ha empate no topo para desempatar' });
  });

  it('requires the selected submission to be part of the top tie', async () => {
    const { db } = createDb({
      submission: {
        id: 'submission-c',
        battleId: 'battle-1',
        status: 'approved',
        userId: 'user-c',
        voteCount: 1,
        publicVoteCount: 1,
      },
      submissions: [
        { id: 'submission-a', userId: 'user-a', status: 'approved', voteCount: 3, publicVoteCount: 3 },
        { id: 'submission-b', userId: 'user-b', status: 'approved', voteCount: 3, publicVoteCount: 3 },
        { id: 'submission-c', userId: 'user-c', status: 'approved', voteCount: 1, publicVoteCount: 1 },
      ],
      entries: [
        { userId: 'user-a', status: 'confirmed' },
        { userId: 'user-b', status: 'confirmed' },
        { userId: 'user-c', status: 'confirmed' },
      ],
    });

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-c',
        actorUserId: 'creator-1',
        now: new Date('2026-05-01T00:01:00.000Z'),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Desempate deve escolher uma submissao empatada no topo',
    });
  });

  it('allows only one tie-break per battle', async () => {
    const { db } = createDb({ hasExistingTieBreak: true });

    await expect(
      resolveBattleTieBreak(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-a',
        actorUserId: 'creator-1',
        now: new Date('2026-05-01T00:01:00.000Z'),
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Esta batalha ja possui desempate registrado',
    });
  });
});
