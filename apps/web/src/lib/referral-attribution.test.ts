import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REFERRAL_STORAGE_KEY,
  clearStoredReferralAttribution,
  createReferralAttribution,
  getStoredReferralAttribution,
  normalizeReferralCode,
  sanitizeReferralPartnerName,
  saveReferralAttribution,
} from './referral-attribution';

describe('referral attribution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sanitizes partner names and normalized analytics codes', () => {
    expect(sanitizeReferralPartnerName(' TikTok ')).toBe('TikTok');
    expect(normalizeReferralCode('Matheus')).toBe('matheus');
    expect(sanitizeReferralPartnerName('random-source')).toBeNull();
    expect(normalizeReferralCode('random-source')).toBeNull();
  });

  it('ignores unregistered referral links', () => {
    const attribution = createReferralAttribution({
      ref: 'Clube_SP',
      landingPath: '/classificatorias?ref=Clube_SP',
      now: new Date('2026-05-12T00:00:00.000Z'),
    });

    expect(attribution).toBeNull();
  });

  it('creates expiring attribution only for registered partner refs', () => {
    const attribution = createReferralAttribution({
      ref: 'Instagram',
      landingPath: '/classificatorias?ref=Instagram',
      now: new Date('2026-05-12T00:00:00.000Z'),
    });

    expect(attribution).toEqual({
      ref: 'instagram',
      partnerName: 'Instagram',
      landingPath: '/classificatorias?ref=Instagram',
      capturedAt: '2026-05-12T00:00:00.000Z',
      expiresAt: '2026-06-11T00:00:00.000Z',
    });
  });

  it('persists attribution through local and session storage until expiry', () => {
    const localStorage = new Map<string, string>();
    const sessionStorage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => localStorage.get(key) ?? null,
        setItem: (key: string, value: string) => localStorage.set(key, value),
        removeItem: (key: string) => localStorage.delete(key),
      },
      sessionStorage: {
        getItem: (key: string) => sessionStorage.get(key) ?? null,
        setItem: (key: string, value: string) => sessionStorage.set(key, value),
        removeItem: (key: string) => sessionStorage.delete(key),
      },
    });

    const attribution = createReferralAttribution({
      ref: 'matheus',
      landingPath: '/',
      now: new Date('2026-05-12T00:00:00.000Z'),
    });
    expect(attribution).not.toBeNull();
    saveReferralAttribution(attribution!);

    expect(localStorage.has(REFERRAL_STORAGE_KEY)).toBe(true);
    expect(sessionStorage.has(REFERRAL_STORAGE_KEY)).toBe(true);
    expect(getStoredReferralAttribution(new Date('2026-05-13T00:00:00.000Z'))?.ref).toBe('matheus');
    expect(getStoredReferralAttribution(new Date('2026-06-12T00:00:00.000Z'))).toBeNull();
  });

  it('clears stored attribution from both storage layers', () => {
    const localStorage = new Map<string, string>([[REFERRAL_STORAGE_KEY, '{}']]);
    const sessionStorage = new Map<string, string>([[REFERRAL_STORAGE_KEY, '{}']]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => localStorage.get(key) ?? null,
        setItem: (key: string, value: string) => localStorage.set(key, value),
        removeItem: (key: string) => localStorage.delete(key),
      },
      sessionStorage: {
        getItem: (key: string) => sessionStorage.get(key) ?? null,
        setItem: (key: string, value: string) => sessionStorage.set(key, value),
        removeItem: (key: string) => sessionStorage.delete(key),
      },
    });

    clearStoredReferralAttribution();

    expect(localStorage.has(REFERRAL_STORAGE_KEY)).toBe(false);
    expect(sessionStorage.has(REFERRAL_STORAGE_KEY)).toBe(false);
  });
});
