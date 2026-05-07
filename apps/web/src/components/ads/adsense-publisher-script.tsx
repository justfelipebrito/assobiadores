import { getGoogleAdsensePublisherConfig } from '@/lib/google-integrations';

export function AdsensePublisherScript() {
  const config = getGoogleAdsensePublisherConfig();
  if (!config) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`}
      crossOrigin="anonymous"
    />
  );
}
