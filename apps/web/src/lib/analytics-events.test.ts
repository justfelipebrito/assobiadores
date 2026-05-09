import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackAnalyticsEvent, trackAuthAttempt, trackAuthCtaClick } from './analytics-events';

describe('analytics events', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when gtag is not available', () => {
    expect(() => trackAnalyticsEvent('test_event')).not.toThrow();
  });

  it('sends generic analytics events through gtag', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackAnalyticsEvent('test_event', { source: 'unit' });

    expect(gtag).toHaveBeenCalledWith('event', 'test_event', { source: 'unit' });
  });

  it('tracks auth CTA clicks without personal data', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackAuthCtaClick({ action: 'signup', location: 'header_desktop' });

    expect(gtag).toHaveBeenCalledWith('event', 'auth_cta_click', {
      auth_action: 'signup',
      click_location: 'header_desktop',
    });
  });

  it('tracks auth attempts by method without personal data', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackAuthAttempt({ action: 'login', method: 'google' });

    expect(gtag).toHaveBeenCalledWith('event', 'auth_attempt', {
      auth_action: 'login',
      method: 'google',
    });
  });
});
