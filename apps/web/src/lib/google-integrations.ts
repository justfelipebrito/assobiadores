type GoogleEnv = {
  NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?: string;
  NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT?: string;
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS?: string;
  NODE_ENV?: string;
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function areGoogleIntegrationsAllowed(env: GoogleEnv = process.env) {
  return env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true';
}

export function getGoogleAnalyticsConfig(env: GoogleEnv = process.env) {
  const measurementId = clean(env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  if (!measurementId || !areGoogleIntegrationsAllowed(env)) return null;

  return { measurementId };
}

export function getGoogleAdsenseConfig(env: GoogleEnv = process.env) {
  const client = clean(env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT);
  const bottomSlot = clean(env.NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT);

  if (!client || !bottomSlot || !areGoogleIntegrationsAllowed(env)) return null;

  return {
    client,
    bottomSlot,
  };
}

export function buildPagePath(pathname: string, searchParams: string) {
  return searchParams ? `${pathname}?${searchParams}` : pathname;
}
