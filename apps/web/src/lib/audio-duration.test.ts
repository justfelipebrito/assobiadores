import { describe, expect, it } from 'vitest';
import { formatDurationLabel, formatTime, getValidDuration } from './audio-duration';

describe('audio duration labels', () => {
  it('formats known durations as mm:ss', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatDurationLabel(65.9)).toBe('1:05');
  });

  it('uses a stable placeholder until a valid media duration is known', () => {
    expect(getValidDuration(null)).toBeNull();
    expect(getValidDuration(0)).toBeNull();
    expect(getValidDuration(Number.NaN)).toBeNull();
    expect(getValidDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDurationLabel(null)).toBe('--:--');
    expect(formatDurationLabel(0)).toBe('--:--');
  });
});
