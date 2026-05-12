import {
  type ReferralAttribution,
  getStoredReferralAttribution,
} from './referral-attribution';

type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackAnalyticsEvent(eventName: string, params: AnalyticsEventParams = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', eventName, params);
}

export function trackAuthCtaClick({
  action,
  location,
}: {
  action: 'login' | 'signup';
  location: string;
}) {
  trackAnalyticsEvent('auth_cta_click', {
    auth_action: action,
    click_location: location,
  });
}

export function trackAuthAttempt({
  action,
  method,
}: {
  action: 'login' | 'signup';
  method: 'email' | 'google' | 'apple';
}) {
  const referral = getStoredReferralAttribution();
  trackAnalyticsEvent('auth_attempt', {
    auth_action: action,
    method,
    ...(referral
      ? {
          partner_ref: referral.ref,
          partner_name: referral.partnerName,
        }
      : {}),
  });
}

export function trackReferralCaptured(referral: ReferralAttribution) {
  trackAnalyticsEvent('partner_referral_captured', {
    partner_ref: referral.ref,
    partner_name: referral.partnerName,
    landing_path: referral.landingPath,
  });
}

export function trackReferralRejected({ ref, landingPath }: { ref: string; landingPath: string }) {
  trackAnalyticsEvent('partner_referral_rejected', {
    attempted_ref: ref,
    landing_path: landingPath,
  });
}

export function trackReferralBootstrap({
  referral,
  created,
}: {
  referral: ReferralAttribution;
  created: boolean;
}) {
  trackAnalyticsEvent('partner_referral_bootstrap', {
    partner_ref: referral.ref,
    partner_name: referral.partnerName,
    created_user: created,
  });
}
