import { describe, expect, it } from 'vitest';
import { shouldShowSubmitDailyHighlightButton } from './submit-daily-highlight-button-visibility';

describe('shouldShowSubmitDailyHighlightButton', () => {
  it('shows the CTA for logged-out users so they can authenticate', () => {
    expect(
      shouldShowSubmitDailyHighlightButton({
        isAuthenticated: false,
        hasSubmittedToday: false,
      }),
    ).toBe(true);
  });

  it('shows the CTA for logged-in users who have not submitted today', () => {
    expect(
      shouldShowSubmitDailyHighlightButton({
        isAuthenticated: true,
        hasSubmittedToday: false,
      }),
    ).toBe(true);
  });

  it('hides the CTA for logged-in users who already submitted today', () => {
    expect(
      shouldShowSubmitDailyHighlightButton({
        isAuthenticated: true,
        hasSubmittedToday: true,
      }),
    ).toBe(false);
  });
});
