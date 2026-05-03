import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import {
  AVATAR_REPLACEMENT_COOLDOWN_DAYS,
  MAX_AVATAR_UPLOAD_BYTES,
  uploadUserAvatar,
} from './avatar-service';

function createDb(userData: Record<string, unknown> = {}) {
  const userRef = { id: 'user-1' };
  const tx = {
    get: vi.fn(async () => ({ exists: true, data: () => userData })),
    update: vi.fn(),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => userRef) })),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, userRef };
}

function createBucket() {
  const file = {
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const bucket = {
    name: 'demo-batalha.appspot.com',
    file: vi.fn(() => file),
  };
  return { bucket, file };
}

describe('avatar service', () => {
  it('uploads an immutable profile photo and stores server-owned profile metadata', async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    const { db, tx } = createDb({ photoVersion: 2, photoPath: null });
    const { bucket, file } = createBucket();

    const result = await uploadUserAvatar({
      db: db as never,
      bucket: bucket as never,
      userId: 'user-1',
      buffer: Buffer.from('jpeg'),
      contentType: 'image/jpeg',
    });

    expect(bucket.file).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/user-1\/profile\/avatar-/),
    );
    expect(file.save).toHaveBeenCalledWith(
      Buffer.from('jpeg'),
      expect.objectContaining({
        resumable: false,
        metadata: expect.objectContaining({
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000, immutable',
        }),
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        photoURL: expect.stringContaining('http://127.0.0.1:9199/v0/b/demo-batalha.appspot.com/o/'),
        photoPath: expect.stringMatching(/^users\/user-1\/profile\/avatar-/),
        photoVersion: 3,
      }),
    );
    expect(result.photoVersion).toBe(3);

    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  it('blocks replacement while the 14 day cooldown is active', async () => {
    const future = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const { db } = createDb({
      photoVersion: 1,
      photoPath: 'users/user-1/profile/avatar-old.jpg',
      photoChangeAvailableAt: future,
    });
    const { bucket, file } = createBucket();

    await expect(
      uploadUserAvatar({
        db: db as never,
        bucket: bucket as never,
        userId: 'user-1',
        buffer: Buffer.from('jpeg'),
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(file.delete).toHaveBeenCalled();
  });

  it('rejects unsupported formats and oversized files', async () => {
    const { db } = createDb();
    const { bucket } = createBucket();

    await expect(
      uploadUserAvatar({
        db: db as never,
        bucket: bucket as never,
        userId: 'user-1',
        buffer: Buffer.from('png'),
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      uploadUserAvatar({
        db: db as never,
        bucket: bucket as never,
        userId: 'user-1',
        buffer: Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1),
        contentType: 'image/jpeg',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sets the next replacement date 14 days ahead', async () => {
    const { db } = createDb();
    const { bucket } = createBucket();
    const before = Date.now();

    const result = await uploadUserAvatar({
      db: db as never,
      bucket: bucket as never,
      userId: 'user-1',
      buffer: Buffer.from('jpeg'),
      contentType: 'image/jpeg',
    });

    const min = before + AVATAR_REPLACEMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    expect(result.photoChangeAvailableAt.getTime()).toBeGreaterThanOrEqual(min);
  });
});
