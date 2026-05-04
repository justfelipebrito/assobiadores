export const SEASON_SCORING = {
  dailyHighlight: {
    submission: 1,
    placements: {
      first: 15,
      second: 10,
      third: 5,
    },
  },
  battle: {
    duelWin: 10,
    groupWin: 20,
  },
  qualifier: {
    entry: 50,
    phaseAdvance: 200,
    qualifyForRegional: 500,
  },
  regional: {
    phaseAdvance: 1000,
    champion: 10000,
    second: 6000,
    third: 4000,
  },
  national: {
    phaseAdvance: 5000,
    champion: 40000,
    second: 25000,
    third: 15000,
  },
} as const;

export type ChampionshipRankingScope = 'regional' | 'national';

export function getDailyHighlightPlacementPoints(place: number) {
  switch (place) {
    case 1:
      return SEASON_SCORING.dailyHighlight.placements.first;
    case 2:
      return SEASON_SCORING.dailyHighlight.placements.second;
    case 3:
      return SEASON_SCORING.dailyHighlight.placements.third;
    default:
      return 0;
  }
}

export function getBattleWinPoints(format: 'duel' | 'group') {
  return format === 'duel' ? SEASON_SCORING.battle.duelWin : SEASON_SCORING.battle.groupWin;
}

export function getChampionshipPhaseAdvancePoints(scope: ChampionshipRankingScope) {
  return scope === 'national'
    ? SEASON_SCORING.national.phaseAdvance
    : SEASON_SCORING.regional.phaseAdvance;
}

export function getChampionshipPlacementPoints(scope: ChampionshipRankingScope, place: number) {
  const table = scope === 'national' ? SEASON_SCORING.national : SEASON_SCORING.regional;

  switch (place) {
    case 1:
      return table.champion;
    case 2:
      return table.second;
    case 3:
      return table.third;
    default:
      return 0;
  }
}
