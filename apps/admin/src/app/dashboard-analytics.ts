export type ReferralAnalyticsRow = {
  ref: string;
  partnerName: string;
  visitors: number;
  referralCaptures: number;
  attributedUsers: number;
  conversionRate: number;
};

export type ReferralAnalyticsResponse = {
  available: boolean;
  rangeLabel: string;
  totals: {
    visitors: number;
    referralCaptures: number;
    attributedUsers: number;
  };
  byRef: ReferralAnalyticsRow[];
  unavailableReason?: string;
};

export function getMaxReferralValue(rows: ReferralAnalyticsRow[]) {
  return Math.max(
    1,
    ...rows.map((row) => Math.max(row.visitors, row.referralCaptures, row.attributedUsers)),
  );
}

export function formatConversionRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  return `${Math.round(value * 100)}%`;
}
