import { describe, expect, it } from 'vitest';
import { getAudioPlayerWaveBarCount, getPlayerChrome } from '../../lib/audio-player-layout';

describe('AudioHighlightPlayer layout', () => {
  it('keeps compact player internals bounded for narrow daily highlight cards', () => {
    const chrome = getPlayerChrome({ size: 'compact', variant: 'default' });

    expect(chrome.shell).toContain('min-w-0');
    expect(chrome.content).toContain('min-w-0');
    expect(chrome.button).toContain('h-8');
    expect(chrome.button).toContain('w-8');
    expect(getAudioPlayerWaveBarCount({ size: 'compact', variant: 'default' })).toBe(18);
  });
});
