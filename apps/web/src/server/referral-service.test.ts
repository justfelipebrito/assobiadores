import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReferralProfileFields, parseReferralAttributionInput } from './referral-service';

describe('referral service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes trusted referral attribution from client storage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z'));

    const referral = parseReferralAttributionInput({
      ref: 'TIKTOK',
      partnerName: 'TikTok',
      landingPath: '/?ref=TikTok',
      capturedAt: '2026-05-12T00:00:00.000Z',
      expiresAt: '2026-06-12T00:00:00.000Z',
    });

    expect(referral).toEqual({
      ref: 'tiktok',
      partnerName: 'TikTok',
      landingPath: '/?ref=TikTok',
      capturedAt: '2026-05-12T00:00:00.000Z',
      expiresAt: '2026-06-12T00:00:00.000Z',
    });
  });

  it('rejects expired or malformed attribution', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00.000Z'));

    expect(parseReferralAttributionInput(null)).toBeNull();
    expect(parseReferralAttributionInput({ ref: 'A' })).toBeNull();
    expect(
      parseReferralAttributionInput({
        ref: 'random-partner',
        landingPath: '/',
        capturedAt: '2026-05-12T00:00:00.000Z',
        expiresAt: '2026-06-01T00:00:00.000Z',
      }),
    ).toBeNull();
    expect(
      parseReferralAttributionInput({
        ref: 'instagram',
        landingPath: '/',
        capturedAt: 'invalid',
        expiresAt: '2026-06-01T00:00:00.000Z',
      }),
    ).toBeNull();
    expect(
      parseReferralAttributionInput({
        ref: 'instagram',
        landingPath: '/',
        capturedAt: '2026-04-01T00:00:00.000Z',
        expiresAt: '2026-05-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('builds public user profile fields without personal data', () => {
    expect(
      buildReferralProfileFields({
        ref: 'instagram',
        partnerName: 'Instagram',
        landingPath: '/',
        capturedAt: '2026-05-12T00:00:00.000Z',
        expiresAt: '2026-06-12T00:00:00.000Z',
      }),
    ).toEqual({
      ref: 'Instagram',
      refCode: 'instagram',
      referral: {
        partnerName: 'Instagram',
        refCode: 'instagram',
        landingPath: '/',
        capturedAt: '2026-05-12T00:00:00.000Z',
      },
    });
  });
});
