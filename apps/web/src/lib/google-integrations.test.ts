import { describe, expect, it } from 'vitest';
import {
  areGoogleIntegrationsAllowed,
  buildPagePath,
  getGoogleAdsenseConfig,
  getGoogleAdsensePublisherConfig,
  getGoogleAnalyticsConfig,
} from './google-integrations';

describe('google integration config', () => {
  it('enables analytics only when a measurement id is configured outside emulator mode', () => {
    expect(getGoogleAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-123' })).toEqual({
      measurementId: 'G-123',
    });
    expect(getGoogleAnalyticsConfig({ NEXT_PUBLIC_GA_MEASUREMENT_ID: '   ' })).toBeNull();
    expect(
      getGoogleAnalyticsConfig({
        NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-123',
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      }),
    ).toBeNull();
  });

  it('enables AdSense bottom banner only when client and slot are both configured', () => {
    expect(
      getGoogleAdsenseConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
        NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT: '456',
      }),
    ).toEqual({
      client: 'ca-pub-123',
      bottomSlot: '456',
    });
    expect(
      getGoogleAdsenseConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
      }),
    ).toBeNull();
    expect(
      getGoogleAdsenseConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
        NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT: '456',
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      }),
    ).toBeNull();
  });

  it('enables the AdSense publisher script with only the client id', () => {
    expect(
      getGoogleAdsensePublisherConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
      }),
    ).toEqual({
      client: 'ca-pub-123',
    });
    expect(
      getGoogleAdsensePublisherConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      }),
    ).toBeNull();
    expect(
      getGoogleAdsensePublisherConfig({
        NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: '   ',
      }),
    ).toBeNull();
  });

  it('blocks Google integrations in emulator mode', () => {
    expect(areGoogleIntegrationsAllowed({ NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true' })).toBe(
      false,
    );
    expect(areGoogleIntegrationsAllowed({ NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false' })).toBe(
      true,
    );
  });

  it('builds route paths for GA page views', () => {
    expect(buildPagePath('/batalhas', '')).toBe('/batalhas');
    expect(buildPagePath('/batalhas', 'status=voting')).toBe('/batalhas?status=voting');
  });
});
