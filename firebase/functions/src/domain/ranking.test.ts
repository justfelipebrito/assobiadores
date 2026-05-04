import { describe, expect, it } from 'vitest';
import {
  calculateRank,
  getBattleWinPoints,
  getChampionshipPhaseAdvancePoints,
  getChampionshipPlacementPoints,
  getDailyHighlightPlacementPoints,
  getPointsForPlace,
  getPrizeForPlace,
  POINTS_TABLE,
} from './ranking';

describe('ranking domain helpers', () => {
  it('returns configured daily highlight points', () => {
    expect(POINTS_TABLE.dailyHighlightSubmission).toBe(1);
    expect(getDailyHighlightPlacementPoints(1)).toBe(15);
    expect(getDailyHighlightPlacementPoints(2)).toBe(10);
    expect(getDailyHighlightPlacementPoints(3)).toBe(5);
    expect(getDailyHighlightPlacementPoints(4)).toBe(0);
  });

  it('returns configured standalone battle win points', () => {
    expect(getBattleWinPoints('duel')).toBe(10);
    expect(getBattleWinPoints('group')).toBe(20);
  });

  it('returns configured qualifier points', () => {
    expect(POINTS_TABLE.qualifierEntry).toBe(50);
    expect(POINTS_TABLE.qualifierPhaseAdvance).toBe(200);
    expect(POINTS_TABLE.qualifyForRegional).toBe(500);
  });

  it('returns configured regional and national championship points', () => {
    expect(getChampionshipPhaseAdvancePoints('regional')).toBe(1000);
    expect(getChampionshipPlacementPoints('regional', 1)).toBe(10000);
    expect(getChampionshipPlacementPoints('regional', 2)).toBe(6000);
    expect(getChampionshipPlacementPoints('regional', 3)).toBe(4000);

    expect(getChampionshipPhaseAdvancePoints('national')).toBe(5000);
    expect(getChampionshipPlacementPoints('national', 1)).toBe(40000);
    expect(getChampionshipPlacementPoints('national', 2)).toBe(25000);
    expect(getChampionshipPlacementPoints('national', 3)).toBe(15000);
  });

  it('keeps generic placement helper regional by default for legacy callers', () => {
    expect(getPointsForPlace(1)).toBe(POINTS_TABLE.regionalFirst);
    expect(getPointsForPlace(2)).toBe(POINTS_TABLE.regionalSecond);
    expect(getPointsForPlace(3)).toBe(POINTS_TABLE.regionalThird);
    expect(getPointsForPlace(4)).toBe(0);
  });

  it('calculates the highest rank reached by points', () => {
    expect(calculateRank(0)).toBe('Iniciante');
    expect(calculateRank(50)).toBe('Aprendiz');
    expect(calculateRank(399)).toBe('Assobiador');
    expect(calculateRank(3000)).toBe('Lenda do Assobio');
  });

  it('returns prize distribution by placement', () => {
    const distribution = { first: 10000, second: 5000, third: 2500 };

    expect(getPrizeForPlace(1, distribution)).toBe(10000);
    expect(getPrizeForPlace(2, distribution)).toBe(5000);
    expect(getPrizeForPlace(3, distribution)).toBe(2500);
    expect(getPrizeForPlace(4, distribution)).toBe(0);
  });

  it('returns zero prize without a configured distribution', () => {
    expect(getPrizeForPlace(1, null)).toBe(0);
  });
});
