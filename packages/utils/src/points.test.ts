import { describe, expect, it } from 'vitest';
import { getPointsForPlace, POINTS_TABLE } from './points';

describe('points utilities', () => {
  it('exposes the unified 2026 scoring constants used by UI helpers', () => {
    expect(POINTS_TABLE.dailyHighlightSubmission).toBe(1);
    expect(POINTS_TABLE.dailyHighlightFirst).toBe(15);
    expect(POINTS_TABLE.duelBattleWin).toBe(10);
    expect(POINTS_TABLE.groupBattleWin).toBe(20);
    expect(POINTS_TABLE.qualifierEntry).toBe(50);
    expect(POINTS_TABLE.qualifierPhaseAdvance).toBe(200);
    expect(POINTS_TABLE.qualifyForRegional).toBe(500);
    expect(POINTS_TABLE.regionalPhaseAdvance).toBe(1000);
    expect(POINTS_TABLE.nationalPhaseAdvance).toBe(5000);
    expect(POINTS_TABLE.nationalFirst).toBe(40000);
    expect(POINTS_TABLE.nationalSecond).toBe(25000);
    expect(POINTS_TABLE.nationalThird).toBe(15000);
  });

  it('keeps placement helper regional by default for legacy callers', () => {
    expect(getPointsForPlace(1)).toBe(10000);
    expect(getPointsForPlace(2)).toBe(6000);
    expect(getPointsForPlace(3)).toBe(4000);
    expect(getPointsForPlace(4)).toBe(0);
  });
});
