import { describe, expect, it } from 'vitest';
import { toDate } from './dates';

describe('toDate', () => {
  it('returns Date values unchanged', () => {
    const date = new Date('2026-04-29T00:00:00.000Z');

    expect(toDate(date)).toBe(date);
  });

  it('converts Firestore timestamp-like values', () => {
    expect(toDate({ seconds: 1777420800 })?.toISOString()).toBe('2026-04-29T00:00:00.000Z');
  });

  it('returns null for missing or unsupported values', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('2026-04-29')).toBeNull();
  });
});
