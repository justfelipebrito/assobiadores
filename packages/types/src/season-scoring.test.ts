import { describe, expect, it } from 'vitest';
import {
  getBattleWinPoints,
  getChampionshipPhaseAdvancePoints,
  getChampionshipPlacementPoints,
  getDailyHighlightPlacementPoints,
  SEASON_SCORING,
} from './season-scoring';

describe('season scoring contract', () => {
  it('defines daily highlight submission and placement points', () => {
    expect(SEASON_SCORING.dailyHighlight.submission).toBe(1);
    expect(getDailyHighlightPlacementPoints(1)).toBe(15);
    expect(getDailyHighlightPlacementPoints(2)).toBe(10);
    expect(getDailyHighlightPlacementPoints(3)).toBe(5);
    expect(getDailyHighlightPlacementPoints(4)).toBe(0);
  });

  it('defines standalone battle win points', () => {
    expect(getBattleWinPoints('duel')).toBe(10);
    expect(getBattleWinPoints('group')).toBe(20);
  });

  it('defines qualifier points', () => {
    expect(SEASON_SCORING.qualifier.entry).toBe(50);
    expect(SEASON_SCORING.qualifier.phaseAdvance).toBe(200);
    expect(SEASON_SCORING.qualifier.qualifyForRegional).toBe(500);
  });

  it('defines regional phase and podium points', () => {
    expect(getChampionshipPhaseAdvancePoints('regional')).toBe(1000);
    expect(getChampionshipPlacementPoints('regional', 1)).toBe(10000);
    expect(getChampionshipPlacementPoints('regional', 2)).toBe(6000);
    expect(getChampionshipPlacementPoints('regional', 3)).toBe(4000);
  });

  it('defines national phase and podium points', () => {
    expect(getChampionshipPhaseAdvancePoints('national')).toBe(5000);
    expect(getChampionshipPlacementPoints('national', 1)).toBe(40000);
    expect(getChampionshipPlacementPoints('national', 2)).toBe(25000);
    expect(getChampionshipPlacementPoints('national', 3)).toBe(15000);
  });
});
