import { getGoogleAdsensePublisherConfig } from '@/lib/google-integrations';
import { getPublicGoogleEnv } from '@/lib/google-runtime-env';

export function AdsensePublisherScript() {
  const config = getGoogleAdsensePublisherConfig(getPublicGoogleEnv());
  if (!config) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`}
      crossOrigin="anonymous"
    />
  );
}
