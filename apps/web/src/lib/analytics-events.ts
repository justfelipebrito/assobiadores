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
  trackAnalyticsEvent('auth_attempt', {
    auth_action: action,
    method,
  });
}
