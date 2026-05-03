import { describe, expect, it } from 'vitest';
import { shouldShowSubmitDailyHighlightButton } from './submit-daily-highlight-button-visibility';

describe('shouldShowSubmitDailyHighlightButton', () => {
  it('hides the CTA for logged-out users', () => {
    expect(shouldShowSubmitDailyHighlightButton(false)).toBe(false);
  });

  it('shows the CTA for logged-in users', () => {
    expect(shouldShowSubmitDailyHighlightButton(true)).toBe(true);
  });
});
