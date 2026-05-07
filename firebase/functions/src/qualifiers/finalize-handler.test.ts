import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { finalizeDueQualifierMatches, finalizeScheduledQualifierMatch } from './finalize-handler';

const baseMatch = {
  status: 'voting',
  participantIds: ['user-a', 'user-b'],
  registrationIds: ['registration-a', 'registration-b'],
  roundNumber: 1,
  category: 'freestyle',
  votingEnd: Timestamp.fromDate(new Date('2026-06-01T21:59:00.000Z')),
};

function ref(id: string) {
  return { id };
}

function querySnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }> = []) {
  return {
    size: docs.length,
    docs,
  };
}

function makeQuery(snapshot: unknown) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => snapshot),
  };
  return query;
}

function createDb({
  match = baseMatch,
  submissions = [
    { id: 'submission-a', userId: 'user-a', status: 'submitted', publicVoteCount: 2 },
    { id: 'submission-b', userId: 'user-b', status: 'submitted', publicVoteCount: 1 },
  ],
  dueDocs = [{ id: 'match-1', data: () => match }],
} = {}) {
  const matchRef = ref('match-1');
  const submissionsQuery = makeQuery(
    querySnapshot(
      submissions.map((submission) => ({
        id: submission.id,
        data: () => submission,
      })),
    ),
  );
  const votesQuery = makeQuery(querySnapshot());
  const dueQuery = makeQuery(querySnapshot(dueDocs));
  const transaction = {
    get: vi.fn(async (target: unknown) => {
      if (target === matchRef) return { exists: true, data: () => match };
      if (target === submissionsQuery) return submissionsQuery.get();
      if (target === votesQuery) return votesQuery.get();
      if (typeof target === 'object' && target !== null && 'id' in target) {
        return {
          exists: true,
          data: () => ({ points: 0, displayName: String((target as { id: string }).id) }),
        };
      }
      throw new Error('Unexpected transaction get target');
    }),
    update: vi.fn(),
    set: vi.fn(),
  };
  const db = {
    runTransaction: vi.fn(async (callback) => callback(transaction)),
    doc: vi.fn((path: string) => ref(path)),
    collection: vi.fn((name: string) => {
      if (name === 'qualifierMatches') {
        return { doc: vi.fn(() => matchRef), where: dueQuery.where };
      }
      if (name === 'qualifierSubmissions') return { where: submissionsQuery.where };
      if (name === 'qualifierVotes') return { where: votesQuery.where };
      if (name === 'qualifierRegistrations') return { doc: vi.fn((id: string) => ref(id)) };
      if (name === 'users') return { doc: vi.fn((id: string) => ref(id)) };
      if (name === 'pointActivities') return { doc: vi.fn((id: string) => ref(id)) };
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, transaction, matchRef, dueQuery };
}

describe('qualifier scheduled finalization', () => {
  it('finalizes an ended voting match and awards the winner phase points', async () => {
    const { db, transaction, matchRef } = createDb();

    await expect(
      finalizeScheduledQualifierMatch(db as never, 'match-1', {
        now: new Date('2026-06-02T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      matchId: 'match-1',
      finalized: true,
      status: 'finished',
      winnerId: 'user-a',
    });

    expect(transaction.update).toHaveBeenCalledWith(
      matchRef,
      expect.objectContaining({
        status: 'finished',
        winnerId: 'user-a',
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-a' }),
      expect.objectContaining({ bracketStatus: 'waiting_draw', currentRound: 2 }),
    );
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-b' }),
      expect.objectContaining({ bracketStatus: 'eliminated', currentRound: 1 }),
    );
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-a' }),
      expect.objectContaining({ points: expect.anything() }),
    );
  });

  it('finalizes one-submission matches as W.O.', async () => {
    const { db, transaction, matchRef } = createDb({
      submissions: [{ id: 'submission-a', userId: 'user-a', status: 'submitted', publicVoteCount: 0 }],
    });

    await expect(
      finalizeScheduledQualifierMatch(db as never, 'match-1', {
        now: new Date('2026-06-02T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      finalized: true,
      status: 'walkover',
      winnerId: 'user-a',
    });

    expect(transaction.update).toHaveBeenCalledWith(
      matchRef,
      expect.objectContaining({
        status: 'walkover',
        walkoverWinnerId: 'user-a',
        disqualifiedUserIds: ['user-b'],
      }),
    );
  });

  it('only picks due voting matches from the scheduler query', async () => {
    const { db, dueQuery } = createDb();

    await expect(
      finalizeDueQualifierMatches(db as never, {
        now: new Date('2026-06-02T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ checkedCount: 1, finalizedCount: 1 });

    expect(dueQuery.where).toHaveBeenCalledWith('status', '==', 'voting');
    expect(dueQuery.where).toHaveBeenCalledWith('votingEnd', '<=', expect.anything());
  });
});
