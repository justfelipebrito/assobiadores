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
  hasParticipantEntry = false,
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  submission?: Record<string, unknown>;
  submissionExists?: boolean;
  hasExistingVote?: boolean;
  hasParticipantEntry?: boolean;
} = {}) {
  const battleRef = { id: 'battle-1' };
  const submissionRef = { id: 'submission-1' };
  const voteRef = { id: 'vote-1' };
  const votesQuery = createQuery(!hasExistingVote);
  const participantEntriesQuery = createQuery(!hasParticipantEntry);
  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === battleRef) {
        return { exists: battleExists, data: () => battle };
      }
      if (target === submissionRef) {
        return { exists: submissionExists, data: () => submission };
      }
      if (target === participantEntriesQuery) {
        return { empty: !hasParticipantEntry };
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
      if (name === 'battleEntries') {
        return {
          where: participantEntriesQuery.where,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, voteRef, submissionRef };
}

describe('createVote', () => {
  it('creates a public vote and increments community vote counts transactionally', async () => {
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
      expect.objectContaining({
        voteCount: expect.anything(),
        publicVoteCount: expect.anything(),
      }),
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

  it('blocks confirmed participants from voting in their own battle', async () => {
    await expect(
      createVote(
        createDb({
          battle: { status: 'voting', createdBy: 'creator-1' },
          hasParticipantEntry: true,
        }).db as never,
        {
          battleId: 'battle-1',
          submissionId: 'submission-1',
          voterId: 'user-1',
        },
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Participantes nao podem votar na propria batalha',
    });
  });

  it('records the battle creator vote as a tie-break signal without incrementing public votes', async () => {
    const { db, tx, voteRef, submissionRef } = createDb({
      battle: { status: 'voting', createdBy: 'creator-1' },
    });

    await expect(
      createVote(db as never, {
        battleId: 'battle-1',
        submissionId: 'submission-1',
        voterId: 'creator-1',
      }),
    ).resolves.toEqual({ voteId: 'vote-1' });

    expect(tx.set).toHaveBeenCalledWith(
      voteRef,
      expect.objectContaining({ voterType: 'judge', voterId: 'creator-1' }),
    );
    const updatePayload = tx.update.mock.calls.find((call) => call[0] === submissionRef)?.[1];
    expect(updatePayload).toEqual(
      expect.objectContaining({ judgeVoteCount: expect.anything() }),
    );
    expect(updatePayload).not.toHaveProperty('voteCount');
    expect(updatePayload).not.toHaveProperty('publicVoteCount');
  });
});
