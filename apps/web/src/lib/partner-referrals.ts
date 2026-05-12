export type PartnerReferral = {
  code: string;
  name: string;
};

export const PARTNER_REFERRALS = [
  { code: 'instagram', name: 'Instagram' },
  { code: 'tiktok', name: 'TikTok' },
  { code: 'matheus', name: 'Matheus' },
] as const satisfies ReadonlyArray<PartnerReferral>;

export type PartnerReferralCode = (typeof PARTNER_REFERRALS)[number]['code'];

const PARTNER_REFERRALS_BY_CODE = new Map<string, PartnerReferral>(
  PARTNER_REFERRALS.map((partner) => [partner.code, partner]),
);

export function normalizePartnerReferralCode(value: unknown) {
  if (typeof value !== 'string') return null;

  const code = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 80);

  return code || null;
}

export function getPartnerReferral(value: unknown) {
  const code = normalizePartnerReferralCode(value);
  return code ? (PARTNER_REFERRALS_BY_CODE.get(code) ?? null) : null;
}

