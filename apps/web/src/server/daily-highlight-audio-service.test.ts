import { describe, expect, it, vi } from 'vitest';
import { DAILY_HIGHLIGHT_MAX_AUDIO_BYTES } from '@batalha/types';
import { uploadDailyHighlightAudio } from './daily-highlight-audio-service';

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

describe('daily highlight audio upload service', () => {
  it('stores compressed audio with immutable cache metadata', async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    const { bucket, file } = createBucket();

    const result = await uploadDailyHighlightAudio({
      bucket,
      userId: 'user-1',
      buffer: Buffer.from('audio'),
      contentType: 'audio/webm',
      category: 'freestyle',
    });

    expect(bucket.file).toHaveBeenCalledWith(expect.stringMatching(/^daily-highlights\/user-1\//));
    expect(file.save).toHaveBeenCalledWith(
      Buffer.from('audio'),
      expect.objectContaining({
        resumable: false,
        metadata: expect.objectContaining({
          contentType: 'audio/webm',
          cacheControl: 'public, max-age=31536000, immutable',
        }),
      }),
    );
    expect(result.audioURL).toContain('http://127.0.0.1:9199/v0/b/demo-batalha.appspot.com/o/');

    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  it('rejects non-audio and oversized payloads', async () => {
    const { bucket } = createBucket();

    await expect(
      uploadDailyHighlightAudio({
        bucket,
        userId: 'user-1',
        buffer: Buffer.from('image'),
        contentType: 'image/png',
        category: 'freestyle',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      uploadDailyHighlightAudio({
        bucket,
        userId: 'user-1',
        buffer: Buffer.alloc(DAILY_HIGHLIGHT_MAX_AUDIO_BYTES + 1),
        contentType: 'audio/webm',
        category: 'freestyle',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
