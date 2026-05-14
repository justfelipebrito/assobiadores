import { describe, expect, it } from 'vitest';
import { formatConversionRate, getMaxReferralValue } from './dashboard-analytics';

describe('dashboard analytics helpers', () => {
  it('calculates a stable chart max with an empty-state floor', () => {
    expect(getMaxReferralValue([])).toBe(1);
    expect(
      getMaxReferralValue([
        {
          ref: 'absoluteassobio',
          partnerName: 'AbsoluteAssobio',
          visitors: 10,
          referralCaptures: 12,
          attributedUsers: 2,
          conversionRate: 0.2,
        },
      ]),
    ).toBe(12);
  });

  it('formats conversion rates for compact dashboard display', () => {
    expect(formatConversionRate(0.234)).toBe('23%');
    expect(formatConversionRate(0)).toBe('0%');
    expect(formatConversionRate(Number.NaN)).toBe('0%');
  });
});
