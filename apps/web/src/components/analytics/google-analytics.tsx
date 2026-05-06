'use client';

import { Suspense, useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { buildPagePath, getGoogleAnalyticsConfig } from '@/lib/google-integrations';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function GoogleAnalyticsPageView({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!window.gtag) return;

    const pagePath = buildPagePath(pathname, searchParams.toString());
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [measurementId, pathname, searchParams]);

  return null;
}

export function GoogleAnalytics() {
  const config = getGoogleAnalyticsConfig();
  if (!config) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${config.measurementId}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsPageView measurementId={config.measurementId} />
      </Suspense>
    </>
  );
}
