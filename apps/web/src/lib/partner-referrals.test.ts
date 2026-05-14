import { describe, expect, it } from 'vitest';
import { getPartnerReferral, normalizePartnerReferralCode } from './partner-referrals';

describe('partner referrals registry', () => {
  it('normalizes partner referral codes', () => {
    expect(normalizePartnerReferralCode(' AbsoluteAssobio ')).toBe('absoluteassobio');
    expect(normalizePartnerReferralCode('São Paulo')).toBe('sao-paulo');
    expect(normalizePartnerReferralCode('###')).toBeNull();
  });

  it('only accepts registered partner codes', () => {
    expect(getPartnerReferral('AbsoluteAssobio')).toEqual({ code: 'absoluteassobio', name: 'AbsoluteAssobio' });
    expect(getPartnerReferral('instagram')).toBeNull();
    expect(getPartnerReferral('tiktok')).toBeNull();
    expect(getPartnerReferral('matheus')).toBeNull();
    expect(getPartnerReferral('random-partner')).toBeNull();
  });
});
