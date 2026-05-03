import { describe, expect, it, vi } from 'vitest';
import { createDailyHighlight, likeDailyHighlight } from './daily-highlight-service';

function createQuery(empty: boolean) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
  };
  return { query, snapshot: { empty } };
}

function createDb({
  user = { displayName: 'User Local' },
  userExists = true,
  hasExistingDailySubmission = false,
  dailyHighlight = { status: 'active', userId: 'author-1' },
  dailyHighlightExists = true,
  hasExistingLike = false,
} = {}) {
  const userRef = { id: 'user-1' };
  const dailyHighlightRef = { id: 'daily-1' };
  const newDailyHighlightRef = { id: 'daily-new' };
  const likeRef = { id: 'like-1' };
  const dailyQuery = createQuery(!hasExistingDailySubmission);
  const likeQuery = createQuery(!hasExistingLike);

  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === userRef) return { exists: userExists, data: () => user };
      if (target === dailyHighlightRef) {
        return { exists: dailyHighlightExists, data: () => dailyHighlight };
      }
      if (target === dailyQuery.query) return dailyQuery.snapshot;
      if (target === likeQuery.query) return likeQuery.snapshot;
      return { empty: true };
    }),
    set: vi.fn(),
    update: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'users') return { doc: vi.fn(() => userRef) };
      if (name === 'dailyHighlights') {
        return {
          doc: vi.fn((id?: string) => (id ? dailyHighlightRef : newDailyHighlightRef)),
          where: dailyQuery.query.where,
        };
      }
      if (name === 'dailyHighlightLikes') {
        return {
          doc: vi.fn(() => likeRef),
          where: likeQuery.query.where,
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, userRef, dailyHighlightRef, newDailyHighlightRef, likeRef };
}

describe('createDailyHighlight', () => {
  it('creates a daily highlight and awards casual points', async () => {
    const { db, tx, userRef, newDailyHighlightRef } = createDb();

    await expect(
      createDailyHighlight(db as never, {
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
        now: new Date('2026-05-03T10:00:00.000Z'),
      }),
    ).resolves.toEqual({ dailyHighlightId: 'daily-new', pointsAwarded: 10 });

    expect(tx.set).toHaveBeenCalledWith(
      newDailyHighlightRef,
      expect.objectContaining({
        dayKey: '2026-05-03',
        userId: 'user-1',
        userDisplayName: 'User Local',
        voteCount: 0,
        pointsAwarded: 10,
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({ casualPoints: expect.anything() }),
    );
  });

  it('rejects invalid URLs and duplicate daily submissions', async () => {
    await expect(
      createDailyHighlight(createDb().db as never, {
        userId: 'user-1',
        videoURL: 'not-a-url',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createDailyHighlight(createDb({ hasExistingDailySubmission: true }).db as never, {
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('likeDailyHighlight', () => {
  it('creates a like and increments the daily highlight vote count', async () => {
    const { db, tx, dailyHighlightRef, likeRef } = createDb();

    await expect(
      likeDailyHighlight(db as never, {
        dailyHighlightId: 'daily-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual({ likeId: 'like-1' });

    expect(tx.set).toHaveBeenCalledWith(
      likeRef,
      expect.objectContaining({ dailyHighlightId: 'daily-1', userId: 'user-1' }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      dailyHighlightRef,
      expect.objectContaining({ voteCount: expect.anything() }),
    );
  });

  it('prevents self-like and duplicate likes', async () => {
    await expect(
      likeDailyHighlight(createDb().db as never, {
        dailyHighlightId: 'daily-1',
        userId: 'author-1',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      likeDailyHighlight(createDb({ hasExistingLike: true }).db as never, {
        dailyHighlightId: 'daily-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
