import { describe, expect, it, vi } from 'vitest';
import { DAILY_HIGHLIGHT_MAX_AUDIO_BYTES } from '@batalha/types';
import {
  uploadDailyHighlightAudio,
  uploadQualifierSubmissionAudio,
} from './daily-highlight-audio-service';

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
  it('stores original webm audio and an m4a playback copy with immutable cache metadata', async () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    const { bucket, file } = createBucket();
    const transcode = vi.fn(async () => Buffer.from('m4a'));

    const result = await uploadDailyHighlightAudio({
      bucket,
      userId: 'user-1',
      buffer: Buffer.from('audio'),
      contentType: 'audio/webm',
      category: 'freestyle',
      transcode,
    });

    expect(bucket.file).toHaveBeenCalledWith(expect.stringMatching(/^daily-highlights\/user-1\//));
    expect(bucket.file).toHaveBeenCalledWith(
      expect.stringMatching(/^daily-highlights\/user-1\/.+-playback\.m4a$/),
    );
    expect(transcode).toHaveBeenCalledWith(Buffer.from('audio'), 'audio/webm');
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
    expect(file.save).toHaveBeenCalledWith(
      Buffer.from('m4a'),
      expect.objectContaining({
        resumable: false,
        metadata: expect.objectContaining({
          contentType: 'audio/mp4',
          cacheControl: 'public, max-age=31536000, immutable',
        }),
      }),
    );
    expect(result.audioURL).toContain('http://127.0.0.1:9199/v0/b/demo-batalha.appspot.com/o/');
    expect(result.audioPath).toMatch(/-playback\.m4a$/);
    expect(result.contentType).toBe('audio/mp4');
    expect(result.sizeBytes).toBe(3);
    expect(result.originalAudioPath).toMatch(/\.webm$/);
    expect(result.originalContentType).toBe('audio/webm');
    expect(result.originalSizeBytes).toBe(5);

    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  it('uses mp4 uploads directly as playback without transcoding', async () => {
    const { bucket, file } = createBucket();
    const transcode = vi.fn(async () => Buffer.from('m4a'));

    const result = await uploadDailyHighlightAudio({
      bucket,
      userId: 'user-1',
      buffer: Buffer.from('mp4'),
      contentType: 'audio/mp4; codecs=mp4a.40.2',
      category: 'freestyle',
      transcode,
    });

    expect(transcode).not.toHaveBeenCalled();
    expect(file.save).toHaveBeenCalledTimes(1);
    expect(result.audioPath).toMatch(/\.m4a$/);
    expect(result.audioPath).toBe(result.originalAudioPath);
    expect(result.contentType).toBe('audio/mp4; codecs=mp4a.40.2');
  });

  it('keeps the original audio when playback transcoding is unavailable', async () => {
    const { bucket, file } = createBucket();
    const transcodeError = Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
    const transcode = vi.fn(async () => {
      throw transcodeError;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await uploadDailyHighlightAudio({
      bucket,
      userId: 'user-1',
      buffer: Buffer.from('audio'),
      contentType: 'audio/webm',
      category: 'freestyle',
      transcode,
    });

    expect(transcode).toHaveBeenCalled();
    expect(file.save).toHaveBeenCalledTimes(1);
    expect(result.audioPath).toMatch(/\.webm$/);
    expect(result.audioPath).toBe(result.originalAudioPath);
    expect(result.contentType).toBe('audio/webm');
    expect(warn).toHaveBeenCalledWith(
      'Audio transcoding unavailable; using original audio as playback.',
      transcodeError,
    );

    warn.mockRestore();
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

  it('stores qualifier match audio under the match path', async () => {
    const { bucket, file } = createBucket();

    const result = await uploadQualifierSubmissionAudio({
      bucket,
      userId: 'user-1',
      matchId: 'match-1',
      buffer: Buffer.from('audio'),
      contentType: 'audio/mp4',
    });

    expect(bucket.file).toHaveBeenCalledWith(
      expect.stringMatching(/^qualifier-submissions\/match-1\/user-1-/),
    );
    expect(file.save).toHaveBeenCalledWith(
      Buffer.from('audio'),
      expect.objectContaining({
        metadata: expect.objectContaining({
          contentType: 'audio/mp4',
          cacheControl: 'public, max-age=31536000, immutable',
        }),
      }),
    );
    expect(result.audioPath).toMatch(/^qualifier-submissions\/match-1\/user-1-/);
  });
});
