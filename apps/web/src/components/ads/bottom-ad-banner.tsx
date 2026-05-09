'use client';

import { useEffect } from 'react';
import { getGoogleAdsenseConfig } from '@/lib/google-integrations';
import { getPublicGoogleEnv } from '@/lib/google-runtime-env';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function BottomAdBanner() {
  const config = getGoogleAdsenseConfig(getPublicGoogleEnv());

  useEffect(() => {
    if (!config) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and preview tools can block AdSense. The app should keep rendering normally.
    }
  }, [config]);

  if (!config) return null;

  return (
    <>
      <div className="h-24 sm:h-28" aria-hidden="true" />
      <aside
        aria-label="Publicidade"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-surface-950/95 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-surface-600">
            Publicidade
          </p>
          <ins
            className="adsbygoogle block min-h-[64px] w-full"
            style={{ display: 'block' }}
            data-ad-client={config.client}
            data-ad-slot={config.bottomSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </aside>
    </>
  );
}
