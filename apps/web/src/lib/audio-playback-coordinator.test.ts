import { describe, expect, it } from 'vitest';
import {
  clearExclusiveAudioPlayback,
  getSeekRatioFromClientX,
  getSeekTimeFromRatio,
  requestExclusiveAudioPlayback,
  subscribeToExclusiveAudioPlayback,
} from './audio-playback-coordinator';

describe('audio playback coordinator', () => {
  it('notifies listeners when another player requests exclusive playback', () => {
    const calls: string[] = [];
    const unsubscribe = subscribeToExclusiveAudioPlayback((playerId) => calls.push(playerId));

    requestExclusiveAudioPlayback('player-a');
    requestExclusiveAudioPlayback('player-b');
    unsubscribe();
    requestExclusiveAudioPlayback('player-c');
    clearExclusiveAudioPlayback('player-b');

    expect(calls).toEqual(['player-a', 'player-b']);
  });

  it('converts pointer position to a clamped seek time', () => {
    expect(getSeekRatioFromClientX({ clientX: 50, left: 0, width: 200 })).toBe(0.25);
    expect(getSeekRatioFromClientX({ clientX: -20, left: 0, width: 200 })).toBe(0);
    expect(getSeekRatioFromClientX({ clientX: 260, left: 0, width: 200 })).toBe(1);
    expect(getSeekRatioFromClientX({ clientX: 50, left: 0, width: 0 })).toBeNull();
    expect(getSeekTimeFromRatio({ ratio: 0.25, durationSeconds: 120 })).toBe(30);
    expect(getSeekTimeFromRatio({ ratio: null, durationSeconds: 120 })).toBeNull();
    expect(getSeekTimeFromRatio({ ratio: 0.25, durationSeconds: null })).toBeNull();
  });
});
