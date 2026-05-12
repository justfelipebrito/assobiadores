'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackReferralCaptured, trackReferralRejected } from '@/lib/analytics-events';
import {
  REFERRAL_QUERY_PARAM,
  createReferralAttribution,
  getInvalidReferralCode,
  saveReferralAttribution,
} from '@/lib/referral-attribution';

function ReferralAttributionCaptureInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get(REFERRAL_QUERY_PARAM);
    if (!ref) return;

    const query = searchParams.toString();
    const attribution = createReferralAttribution({
      ref,
      landingPath: query ? `${pathname}?${query}` : pathname,
    });
    if (!attribution) {
      const invalidRef = getInvalidReferralCode(ref);
      if (invalidRef) {
        trackReferralRejected({
          ref: invalidRef,
          landingPath: query ? `${pathname}?${query}` : pathname,
        });
      }
      return;
    }

    saveReferralAttribution(attribution);
    trackReferralCaptured(attribution);
  }, [pathname, searchParams]);

  return null;
}

export function ReferralAttributionCapture() {
  return (
    <Suspense fallback={null}>
      <ReferralAttributionCaptureInner />
    </Suspense>
  );
}
