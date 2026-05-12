import { describe, expect, it } from 'vitest';
import { getPartnerReferral, normalizePartnerReferralCode } from './partner-referrals';

describe('partner referrals registry', () => {
  it('normalizes partner referral codes', () => {
    expect(normalizePartnerReferralCode(' TikTok ')).toBe('tiktok');
    expect(normalizePartnerReferralCode('São Paulo')).toBe('sao-paulo');
    expect(normalizePartnerReferralCode('###')).toBeNull();
  });

  it('only accepts registered partner codes', () => {
    expect(getPartnerReferral('instagram')).toEqual({ code: 'instagram', name: 'Instagram' });
    expect(getPartnerReferral('TikTok')).toEqual({ code: 'tiktok', name: 'TikTok' });
    expect(getPartnerReferral('random-partner')).toBeNull();
  });
});

