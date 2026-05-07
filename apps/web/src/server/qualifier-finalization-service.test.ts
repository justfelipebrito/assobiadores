import { describe, expect, it, vi } from 'vitest';
import { finalizeQualifierMatch } from './qualifier-finalization-service';

const baseMatch = {
  id: 'match-1',
  status: 'voting',
  category: 'freestyle',
  roundNumber: 1,
  participantIds: ['user-a', 'user-b'],
  registrationIds: ['registration-a', 'registration-b'],
};

type TestSubmission = {
  id: string;
  userId: string;
  status: string;
  publicVoteCount: number;
};

type TestVote = {
  votedUserId: string;
  voterType: string;
  createdAt: { seconds: number };
};

function createDb({
  admin = { role: 'admin' },
  match = baseMatch,
  submissions = [
    { id: 'submission-a', userId: 'user-a', status: 'submitted', publicVoteCount: 3 },
    { id: 'submission-b', userId: 'user-b', status: 'submitted', publicVoteCount: 1 },
  ],
  votes = [],
}: {
  admin?: Record<string, unknown>;
  match?: Record<string, unknown>;
  submissions?: TestSubmission[];
  votes?: TestVote[];
} = {}) {
  const refs = new Map<string, { id: string }>();
  const ref = (id: string) => {
    if (!refs.has(id)) refs.set(id, { id });
    return refs.get(id)!;
  };
  const submissionsQuery = { where: vi.fn(() => submissionsQuery) };
  const votesQuery = { where: vi.fn(() => votesQuery) };
  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === ref('admin-1')) return { exists: true, data: () => admin };
      if (target === ref('match-1')) return { exists: true, data: () => match };
      if (target === submissionsQuery) {
        return {
          docs: submissions.map((submission) => ({
            id: submission.id,
            ref: ref(submission.id),
            data: () => ({ matchId: 'match-1', ...submission }),
          })),
        };
      }
      if (target === votesQuery) {
        return {
          docs: votes.map((vote) => ({
            data: () => vote,
          })),
        };
      }
      return { exists: true, data: () => ({}) };
    }),
    update: vi.fn(),
    set: vi.fn(),
  };
  const db = {
    doc: vi.fn((path: string) => ref(path)),
    collection: vi.fn((name: string) => {
      if (name === 'users') return { doc: vi.fn((id: string) => ref(id)) };
      if (name === 'qualifierMatches') return { doc: vi.fn(() => ref('match-1')) };
      if (name === 'qualifierSubmissions') return { where: submissionsQuery.where };
      if (name === 'qualifierVotes') return { where: votesQuery.where };
      if (name === 'qualifierRegistrations') return { doc: vi.fn((id: string) => ref(id)) };
      if (name === 'pointActivities') return { doc: vi.fn((id: string) => ref(id)) };
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, ref };
}

describe('finalizeQualifierMatch', () => {
  it('finalizes by public vote count and awards qualifier phase points', async () => {
    const { db, tx, ref } = createDb();

    await expect(
      finalizeQualifierMatch(db as never, { matchId: 'match-1', adminUserId: 'admin-1' }),
    ).resolves.toMatchObject({
      status: 'finished',
      winnerId: 'user-a',
      pointsAwarded: 200,
      eliminatedUserIds: ['user-b'],
    });

    expect(tx.update).toHaveBeenCalledWith(
      ref('match-1'),
      expect.objectContaining({ status: 'finished', winnerId: 'user-a' }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      ref('registration-a'),
      expect.objectContaining({ bracketStatus: 'waiting_draw', currentMatchId: null }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      ref('registration-b'),
      expect.objectContaining({ bracketStatus: 'eliminated', currentMatchId: 'match-1' }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      ref('user-a'),
      expect.objectContaining({
        points: expect.anything(),
        'seasonCategoryPoints.2026.freestyle.points': expect.anything(),
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      ref('qualifier__match-1__qualifier_phase_advance__user-a'),
      expect.objectContaining({
        userId: 'user-a',
        points: 200,
        reason: 'qualifier_phase_advance',
        sourceType: 'qualifier',
        sourceId: 'match-1',
        category: 'freestyle',
      }),
    );
  });

  it('handles W.O. when only one participant submitted', async () => {
    const { db } = createDb({
      submissions: [
        { id: 'submission-a', userId: 'user-a', status: 'submitted', publicVoteCount: 0 },
      ],
    });

    await expect(
      finalizeQualifierMatch(db as never, { matchId: 'match-1', adminUserId: 'admin-1' }),
    ).resolves.toMatchObject({
      status: 'walkover',
      winnerId: 'user-a',
      walkoverWinnerId: 'user-a',
      disqualifiedUserIds: ['user-b'],
    });
  });

  it('uses the first judge vote as the tiebreaker when public counts tie', async () => {
    const { db } = createDb({
      submissions: [
        { id: 'submission-a', userId: 'user-a', status: 'submitted', publicVoteCount: 2 },
        { id: 'submission-b', userId: 'user-b', status: 'submitted', publicVoteCount: 2 },
      ],
      votes: [
        { votedUserId: 'user-a', voterType: 'public', createdAt: { seconds: 1 } },
        { votedUserId: 'user-b', voterType: 'judge', createdAt: { seconds: 2 } },
      ],
    });

    await expect(
      finalizeQualifierMatch(db as never, { matchId: 'match-1', adminUserId: 'admin-1' }),
    ).resolves.toMatchObject({
      status: 'finished',
      winnerId: 'user-b',
    });
  });

  it('disqualifies both when nobody submitted and blocks non-admin finalization', async () => {
    await expect(
      finalizeQualifierMatch(createDb({ submissions: [] }).db as never, {
        matchId: 'match-1',
        adminUserId: 'admin-1',
      }),
    ).resolves.toMatchObject({
      status: 'walkover',
      winnerId: null,
      disqualifiedUserIds: ['user-a', 'user-b'],
      pointsAwarded: 0,
    });

    await expect(
      finalizeQualifierMatch(createDb({ admin: { role: 'user' } }).db as never, {
        matchId: 'match-1',
        adminUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
