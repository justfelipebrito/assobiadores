import { getPartnerReferral, normalizePartnerReferralCode } from './partner-referrals';

export const REFERRAL_QUERY_PARAM = 'ref';
export const REFERRAL_STORAGE_KEY = 'assobiador.partnerReferral';
export const REFERRAL_TTL_DAYS = 30;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type ReferralAttribution = {
  ref: string;
  partnerName: string;
  landingPath: string;
  capturedAt: string;
  expiresAt: string;
};

export function sanitizeReferralPartnerName(value: unknown) {
  return getPartnerReferral(value)?.name ?? null;
}

export function normalizeReferralCode(value: string) {
  return getPartnerReferral(value)?.code ?? null;
}

export function createReferralAttribution({
  ref,
  landingPath,
  now = new Date(),
}: {
  ref: unknown;
  landingPath: string;
  now?: Date;
}) {
  if (Number.isNaN(now.getTime())) return null;

  const partner = getPartnerReferral(ref);
  if (!partner) return null;

  const capturedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + REFERRAL_TTL_DAYS * ONE_DAY_MS).toISOString();

  return {
    ref: partner.code,
    partnerName: partner.name,
    landingPath: landingPath.slice(0, 500),
    capturedAt,
    expiresAt,
  };
}

export function getInvalidReferralCode(value: unknown) {
  const normalized = normalizePartnerReferralCode(value);
  if (!normalized || getPartnerReferral(normalized)) return null;
  return normalized;
}

function getStorage(storage: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') return null;
  try {
    return window[storage];
  } catch {
    return null;
  }
}

function parseStoredReferral(value: string | null, now = new Date()) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ReferralAttribution>;
    const attribution = createReferralAttribution({
      ref: parsed.partnerName || parsed.ref,
      landingPath: typeof parsed.landingPath === 'string' ? parsed.landingPath : '/',
      now: parsed.capturedAt ? new Date(parsed.capturedAt) : now,
    });

    if (!attribution || !parsed.expiresAt) return null;
    const expiresAtMs = new Date(parsed.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) return null;

    return {
      ...attribution,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function saveReferralAttribution(attribution: ReferralAttribution) {
  const serialized = JSON.stringify(attribution);
  getStorage('localStorage')?.setItem(REFERRAL_STORAGE_KEY, serialized);
  getStorage('sessionStorage')?.setItem(REFERRAL_STORAGE_KEY, serialized);
}

export function getStoredReferralAttribution(now = new Date()) {
  const local = parseStoredReferral(getStorage('localStorage')?.getItem(REFERRAL_STORAGE_KEY) ?? null, now);
  if (local) return local;

  const session = parseStoredReferral(
    getStorage('sessionStorage')?.getItem(REFERRAL_STORAGE_KEY) ?? null,
    now,
  );
  if (session) return session;

  clearStoredReferralAttribution();
  return null;
}

export function clearStoredReferralAttribution() {
  getStorage('localStorage')?.removeItem(REFERRAL_STORAGE_KEY);
  getStorage('sessionStorage')?.removeItem(REFERRAL_STORAGE_KEY);
}
