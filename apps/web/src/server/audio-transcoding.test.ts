import { describe, expect, it } from 'vitest';
import { needsPlaybackTranscode, PLAYBACK_AUDIO_CONTENT_TYPE } from './audio-transcoding';

describe('audio transcoding helpers', () => {
  it('normalizes non-mp4 browser recordings to mp4 playback audio', () => {
    expect(needsPlaybackTranscode('audio/webm;codecs=opus')).toBe(true);
    expect(needsPlaybackTranscode('audio/ogg;codecs=opus')).toBe(true);
    expect(PLAYBACK_AUDIO_CONTENT_TYPE).toBe('audio/mp4');
  });

  it('does not transcode mobile-safe aac/mp4 recordings', () => {
    expect(needsPlaybackTranscode('audio/mp4; codecs=mp4a.40.2')).toBe(false);
    expect(needsPlaybackTranscode('audio/aac')).toBe(false);
  });
});
