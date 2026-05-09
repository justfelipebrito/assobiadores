import { describe, expect, it, vi } from 'vitest';
import {
  createAudioMediaRecorder,
  getAudioCaptureConstraints,
  getAudioRecorderOptions,
  getRecordedAudioFileName,
  getRecordingAudioStream,
  getSupportedAudioRecorderMimeType,
} from './audio-recording';

describe('audio recording helpers', () => {
  it('prefers mp4 on Apple browsers so mobile previews can play back reliably', () => {
    const supported = new Set(['audio/mp4', 'audio/webm;codecs=opus']);

    expect(
      getSupportedAudioRecorderMimeType({
        isTypeSupported: (mimeType) => supported.has(mimeType),
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari',
      }),
    ).toBe('audio/mp4');
  });

  it('prefers opus webm on non-Apple browsers', () => {
    const supported = new Set(['audio/mp4', 'audio/webm;codecs=opus']);

    expect(
      getSupportedAudioRecorderMimeType({
        isTypeSupported: (mimeType) => supported.has(mimeType),
        userAgent: 'Mozilla/5.0 Chrome/124.0',
      }),
    ).toBe('audio/webm;codecs=opus');
  });

  it('uses a higher audio bitrate and supported mime type for MediaRecorder', () => {
    const options = getAudioRecorderOptions({
      isTypeSupported: (mimeType) => mimeType === 'audio/webm',
      userAgent: 'Chrome',
    });

    expect(options).toMatchObject({
      mimeType: 'audio/webm',
      audioBitsPerSecond: 128_000,
    });
  });

  it('retries MediaRecorder without custom options when a browser rejects supported-looking options', () => {
    const stream = {} as MediaStream;
    const calls: unknown[][] = [];

    class ConstructableMediaRecorder {
      stream: MediaStream;

      constructor(nextStream: MediaStream, options?: MediaRecorderOptions) {
        calls.push(options ? [nextStream, options] : [nextStream]);
        if (calls.length === 1) {
          throw new Error('constructor rejected options');
        }
        this.stream = nextStream;
      }
    }

    const recorder = createAudioMediaRecorder({
      stream,
      mediaRecorder: ConstructableMediaRecorder as unknown as typeof MediaRecorder,
      isTypeSupported: () => true,
      userAgent: 'Chrome',
    });

    expect(recorder).toMatchObject({ stream });
    expect(calls).toEqual([
      [
        stream,
        expect.objectContaining({ audioBitsPerSecond: 128_000 }),
      ],
      [stream],
    ]);
  });

  it('requests capture settings tuned for whistle audio instead of voice-call processing', () => {
    expect(getAudioCaptureConstraints()).toMatchObject({
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('falls back to browser defaults when quality constraints are rejected', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('unsupported constraints'))
      .mockResolvedValueOnce('stream');

    await expect(
      getRecordingAudioStream({ getUserMedia } as unknown as MediaDevices),
    ).resolves.toBe('stream');
    expect(getUserMedia).toHaveBeenNthCalledWith(1, getAudioCaptureConstraints());
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { audio: true });
  });

  it('matches upload filename extension to the actual recorded content type', () => {
    expect(getRecordedAudioFileName('audio/mp4')).toBe('assobio.m4a');
    expect(getRecordedAudioFileName('audio/ogg;codecs=opus')).toBe('assobio.ogg');
    expect(getRecordedAudioFileName('audio/webm;codecs=opus')).toBe('assobio.webm');
  });
});
