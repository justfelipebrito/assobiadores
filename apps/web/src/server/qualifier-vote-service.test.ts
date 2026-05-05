import { describe, expect, it, vi } from 'vitest';
import { createQualifierVote } from './qualifier-vote-service';

const baseMatch = {
  id: 'match-1',
  status: 'voting',
  participantIds: ['participant-1', 'participant-2'],
  votingStart: new Date('2026-06-01T18:00:00.000Z'),
  votingEnd: new Date('2026-06-02T00:59:00.000Z'),
};

function createQuery(empty: boolean) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
  };
  return { query, snapshot: { empty } };
}

function createDb({
  match = baseMatch,
  submission = {
    id: 'submission-1',
    matchId: 'match-1',
    userId: 'participant-1',
    status: 'submitted',
  },
  hasExistingVote = false,
} = {}) {
  const matchRef = { id: 'match-1' };
  const submissionRef = { id: 'submission-1' };
  const voteRef = { id: 'vote-1' };
  const voteQuery = createQuery(!hasExistingVote);
  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === matchRef) return { exists: true, data: () => match };
      if (target === submissionRef) return { exists: true, data: () => submission };
      if (target === voteQuery.query) return voteQuery.snapshot;
      throw new Error('Unexpected get target');
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'qualifierMatches') return { doc: vi.fn(() => matchRef) };
      if (name === 'qualifierSubmissions') return { doc: vi.fn(() => submissionRef) };
      if (name === 'qualifierVotes') {
        return { doc: vi.fn(() => voteRef), where: voteQuery.query.where };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, voteRef, submissionRef, matchRef };
}

describe('createQualifierVote', () => {
  it('creates a public qualifier vote and increments submission/match counts', async () => {
    const { db, tx, voteRef, submissionRef, matchRef } = createDb();

    await expect(
      createQualifierVote(db as never, {
        matchId: 'match-1',
        submissionId: 'submission-1',
        voterId: 'voter-1',
        now: new Date('2026-06-01T19:00:00.000Z'),
      }),
    ).resolves.toEqual({ qualifierVoteId: 'vote-1' });

    expect(tx.set).toHaveBeenCalledWith(
      voteRef,
      expect.objectContaining({
        matchId: 'match-1',
        submissionId: 'submission-1',
        votedUserId: 'participant-1',
        voterId: 'voter-1',
        voterType: 'public',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      submissionRef,
      expect.objectContaining({ publicVoteCount: expect.anything() }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      matchRef,
      expect.objectContaining({ 'publicVoteCounts.participant-1': expect.anything() }),
    );
  });

  it('blocks qualifier participants and duplicate voters', async () => {
    await expect(
      createQualifierVote(createDb().db as never, {
        matchId: 'match-1',
        submissionId: 'submission-1',
        voterId: 'participant-1',
        now: new Date('2026-06-01T19:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      createQualifierVote(createDb({ hasExistingVote: true }).db as never, {
        matchId: 'match-1',
        submissionId: 'submission-1',
        voterId: 'voter-1',
        now: new Date('2026-06-01T19:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('enforces match status and voting window', async () => {
    await expect(
      createQualifierVote(
        createDb({ match: { ...baseMatch, status: 'submissions_open' } }).db as never,
        {
          matchId: 'match-1',
          submissionId: 'submission-1',
          voterId: 'voter-1',
          now: new Date('2026-06-01T19:00:00.000Z'),
        },
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createQualifierVote(createDb().db as never, {
        matchId: 'match-1',
        submissionId: 'submission-1',
        voterId: 'voter-1',
        now: new Date('2026-06-01T17:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Votacao ainda nao comecou' });
  });
});
