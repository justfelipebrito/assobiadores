import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  trackAnalyticsEvent,
  trackAuthAttempt,
  trackAuthCtaClick,
  trackReferralBootstrap,
  trackReferralCaptured,
  trackReferralRejected,
} from './analytics-events';
import { REFERRAL_STORAGE_KEY } from './referral-attribution';

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

  it('adds stored partner attribution to auth attempts', () => {
    const gtag = vi.fn();
    const stored = JSON.stringify({
      ref: 'instagram',
      partnerName: 'Instagram',
      landingPath: '/?ref=instagram',
      capturedAt: '2026-05-12T00:00:00.000Z',
      expiresAt: '2026-06-12T00:00:00.000Z',
    });
    vi.stubGlobal('window', {
      gtag,
      localStorage: {
        getItem: (key: string) => (key === REFERRAL_STORAGE_KEY ? stored : null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      sessionStorage: {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });

    trackAuthAttempt({ action: 'signup', method: 'email' });

    expect(gtag).toHaveBeenCalledWith('event', 'auth_attempt', {
      auth_action: 'signup',
      method: 'email',
      partner_ref: 'instagram',
      partner_name: 'Instagram',
    });
  });

  it('tracks partner referral capture and bootstrap without personal data', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    const referral = {
      ref: 'matheus',
      partnerName: 'Matheus',
      landingPath: '/classificatorias?ref=matheus',
      capturedAt: '2026-05-12T00:00:00.000Z',
      expiresAt: '2026-06-12T00:00:00.000Z',
    };

    trackReferralCaptured(referral);
    trackReferralBootstrap({ referral, created: true });

    expect(gtag).toHaveBeenCalledWith('event', 'partner_referral_captured', {
      partner_ref: 'matheus',
      partner_name: 'Matheus',
      landing_path: '/classificatorias?ref=matheus',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'partner_referral_bootstrap', {
      partner_ref: 'matheus',
      partner_name: 'Matheus',
      created_user: true,
    });
  });

  it('tracks rejected referral attempts without storing them as attribution', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });

    trackReferralRejected({ ref: 'random-partner', landingPath: '/?ref=random-partner' });

    expect(gtag).toHaveBeenCalledWith('event', 'partner_referral_rejected', {
      attempted_ref: 'random-partner',
      landing_path: '/?ref=random-partner',
    });
  });
});
