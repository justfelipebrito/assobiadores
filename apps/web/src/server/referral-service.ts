import {
  type ReferralAttribution,
  createReferralAttribution,
} from '../lib/referral-attribution';

export type TrustedReferralAttribution = ReferralAttribution;

export function parseReferralAttributionInput(input: unknown): TrustedReferralAttribution | null {
  if (!input || typeof input !== 'object') return null;

  const value = input as Partial<ReferralAttribution>;
  if (typeof value.expiresAt !== 'string') return null;
  const expiresAtMs = new Date(value.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) return null;

  const attribution = createReferralAttribution({
    ref: value.partnerName || value.ref,
    landingPath: typeof value.landingPath === 'string' ? value.landingPath : '/',
    now: value.capturedAt ? new Date(value.capturedAt) : new Date(),
  });

  if (!attribution) return null;

  return {
    ...attribution,
    expiresAt: value.expiresAt,
  };
}

export function buildReferralProfileFields(referral: TrustedReferralAttribution) {
  return {
    ref: referral.partnerName,
    refCode: referral.ref,
    referral: {
      partnerName: referral.partnerName,
      refCode: referral.ref,
      landingPath: referral.landingPath,
      capturedAt: referral.capturedAt,
    },
  };
}
