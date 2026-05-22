import { describe, expect, it } from 'vitest';
import { getResolvedAudioDurationSeconds } from './audio-transcoding';

describe('audio transcoding helpers', () => {
  it('prefers the duration detected from the uploaded media', () => {
    expect(
      getResolvedAudioDurationSeconds({
        detectedDurationSeconds: 6.4,
        clientDurationSeconds: 5,
      }),
    ).toBe(6);
  });

  it('falls back to the client stopwatch when probing is unavailable', () => {
    expect(
      getResolvedAudioDurationSeconds({
        detectedDurationSeconds: null,
        clientDurationSeconds: 12.2,
      }),
    ).toBe(12);
  });

  it('returns zero when neither source has a usable duration', () => {
    expect(
      getResolvedAudioDurationSeconds({
        detectedDurationSeconds: Number.NaN,
        clientDurationSeconds: 0,
      }),
    ).toBe(0);
  });
});
