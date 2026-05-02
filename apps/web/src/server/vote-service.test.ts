import { describe, expect, it, vi } from 'vitest';
import { createVote } from './vote-service';

function createQuery(empty: boolean) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => ({ empty })),
  };
  return query;
}

function createDb({
  battle = { status: 'voting' },
  battleExists = true,
  submission = {
    battleId: 'battle-1',
    status: 'approved',
    userId: 'author-1',
  },
  submissionExists = true,
  hasExistingVote = false,
} = {}) {
  const battleRef = { id: 'battle-1' };
  const submissionRef = { id: 'submission-1' };
  const voteRef = { id: 'vote-1' };
  const votesQuery = createQuery(!hasExistingVote);
  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === battleRef) {
        return { exists: battleExists, data: () => battle };
      }
      if (target === submissionRef) {
        return { exists: submissionExists, data: () => submission };
      }
      return { empty: !hasExistingVote };
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') return { doc: vi.fn(() => battleRef) };
      if (name === 'submissions') return { doc: vi.fn(() => submissionRef) };
      if (name === 'votes') {
        return {
          doc: vi.fn(() => voteRef),
          where: votesQuery.where,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, voteRef, submissionRef };
}

describe('createVote', () => {
  it('creates a vote and increments vote count transactionally', async () => {
    const { db, tx, voteRef, submissionRef } = createDb();

    await expect(
      createVote(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'user-1',
      }),
    ).resolves.toEqual({ voteId: 'vote-1' });

    expect(tx.set).toHaveBeenCalledWith(
      voteRef,
      expect.objectContaining({
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'user-1',
        weight: 1,
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      submissionRef,
      expect.objectContaining({ voteCount: expect.anything() }),
    );
  });

  it('requires battle to be in voting phase', async () => {
    const { db } = createDb({ battle: { status: 'active' } });

    await expect(
      createVote(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires an approved submission for the same battle', async () => {
    const { db } = createDb({
      submission: { battleId: 'other-battle', status: 'approved', userId: 'author-1' },
    });

    await expect(
      createVote(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('prevents self-voting and duplicate votes', async () => {
    await expect(
      createVote(createDb().db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'author-1',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createVote(createDb({ hasExistingVote: true }).db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
