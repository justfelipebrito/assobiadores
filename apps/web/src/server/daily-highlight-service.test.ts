import { describe, expect, it, vi } from 'vitest';
import {
  createDailyHighlight,
  createDailyHighlightFromAudio,
  likeDailyHighlight,
} from './daily-highlight-service';

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
  dailyHighlight = { status: 'active', userId: 'author-1', dayKey: '2026-05-03' },
  dailyHighlightExists = true,
  hasExistingLike = false,
} = {}) {
  const userRef = { id: 'user-1' };
  const dailyHighlightRef = { id: 'daily-1' };
  const newDailyHighlightRef = { id: 'daily-new' };
  const likeRef = { id: '2026-05-03_user-1' };
  const dailyQuery = createQuery(!hasExistingDailySubmission);

  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === userRef) return { exists: userExists, data: () => user };
      if (target === dailyHighlightRef) {
        return { exists: dailyHighlightExists, data: () => dailyHighlight };
      }
      if (target === dailyQuery.query) return dailyQuery.snapshot;
      if (target === likeRef) return { exists: hasExistingLike };
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
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, userRef, dailyHighlightRef, newDailyHighlightRef, likeRef };
}

describe('createDailyHighlight', () => {
  it('rejects legacy external video submissions', async () => {
    await expect(
      createDailyHighlight(createDb().db as never, {
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Destaques Diarios aceitam apenas audio gravado na plataforma',
    });
  });

  it('creates an audio daily highlight with category metadata', async () => {
    const { db, tx, userRef, newDailyHighlightRef } = createDb();

    await expect(
      createDailyHighlightFromAudio(db as never, {
        userId: 'user-1',
        audioURL: 'https://storage.example/audio.webm',
        audioPath: 'daily-highlights/user-1/audio.webm',
        contentType: 'audio/webm',
        sizeBytes: 1234,
        durationSeconds: 42,
        category: 'melodia',
        now: new Date('2026-05-03T10:00:00.000Z'),
      }),
    ).resolves.toEqual({ dailyHighlightId: 'daily-new', pointsAwarded: 1 });

    expect(tx.set).toHaveBeenCalledWith(
      newDailyHighlightRef,
      expect.objectContaining({
        category: 'melodia',
        mediaType: 'audio',
        mediaURL: 'https://storage.example/audio.webm',
        mediaPath: 'daily-highlights/user-1/audio.webm',
        mediaDurationSeconds: 42,
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({
        'seasonCategoryPoints.2026.melodia.points': expect.anything(),
        'seasonCategoryPoints.2026.melodia.xp': expect.anything(),
        'seasonCategoryPoints.2026.melodia.rank': 'Iniciante',
      }),
    );
  });

  it('rejects audio highlights over 2 minutes', async () => {
    await expect(
      createDailyHighlightFromAudio(createDb().db as never, {
        userId: 'user-1',
        audioURL: 'https://storage.example/audio.webm',
        audioPath: 'daily-highlights/user-1/audio.webm',
        contentType: 'audio/webm',
        sizeBytes: 1234,
        durationSeconds: 121,
        category: 'freestyle',
      }),
    ).rejects.toMatchObject({ status: 400 });
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
    ).resolves.toEqual({ likeId: '2026-05-03_user-1' });

    expect(tx.set).toHaveBeenCalledWith(
      likeRef,
      expect.objectContaining({
        dayKey: '2026-05-03',
        dailyHighlightId: 'daily-1',
        userId: 'user-1',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      dailyHighlightRef,
      expect.objectContaining({ voteCount: expect.anything() }),
    );
  });

  it('prevents self-like and duplicate daily votes', async () => {
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
    ).rejects.toMatchObject({ status: 409, message: 'Voce ja votou em um destaque hoje' });
  });

  it('rejects votes after the 22:00 Brazil deadline', async () => {
    await expect(
      likeDailyHighlight(createDb().db as never, {
        dailyHighlightId: 'daily-1',
        userId: 'user-1',
        now: new Date('2026-05-06T01:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'A votacao dos destaques diarios encerra as 22:00',
    });
  });
});
