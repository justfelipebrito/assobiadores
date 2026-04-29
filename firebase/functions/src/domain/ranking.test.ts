import { describe, expect, it } from 'vitest';
import { calculateRank, getPointsForPlace, getPrizeForPlace, POINTS_TABLE } from './ranking';

describe('ranking domain helpers', () => {
  it('returns configured points by placement', () => {
    expect(getPointsForPlace(1)).toBe(POINTS_TABLE.first);
    expect(getPointsForPlace(2)).toBe(POINTS_TABLE.second);
    expect(getPointsForPlace(3)).toBe(POINTS_TABLE.third);
    expect(getPointsForPlace(4)).toBe(POINTS_TABLE.participation);
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
