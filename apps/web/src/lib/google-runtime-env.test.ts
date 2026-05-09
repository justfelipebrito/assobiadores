import { afterEach, describe, expect, it } from 'vitest';
import { getPublicGoogleEnv } from './google-runtime-env';

const ORIGINAL_ENV = { ...process.env };

describe('getPublicGoogleEnv', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns only browser-safe Google integration environment values', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123';
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT = 'ca-pub-123';
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT = '456';
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'false';
    process.env.MP_ACCESS_TOKEN = 'server-secret';

    expect(getPublicGoogleEnv()).toEqual({
      NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST123',
      NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: 'ca-pub-123',
      NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT: '456',
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false',
    });
  });
});
