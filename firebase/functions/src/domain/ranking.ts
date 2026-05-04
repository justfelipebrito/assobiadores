export const POINTS_TABLE = {
  dailyHighlightSubmission: 1,
  dailyHighlightFirst: 15,
  dailyHighlightSecond: 10,
  dailyHighlightThird: 5,
  duelBattleWin: 10,
  groupBattleWin: 20,
  qualifierEntry: 50,
  qualifierPhaseAdvance: 200,
  qualifyForRegional: 500,
  regionalPhaseAdvance: 1000,
  regionalFirst: 10000,
  regionalSecond: 6000,
  regionalThird: 4000,
  nationalPhaseAdvance: 5000,
  nationalFirst: 40000,
  nationalSecond: 25000,
  nationalThird: 15000,
} as const;

export const RANKS = [
  { minPoints: 0, name: 'Iniciante', tier: 1 },
  { minPoints: 50, name: 'Aprendiz', tier: 2 },
  { minPoints: 150, name: 'Assobiador', tier: 3 },
  { minPoints: 400, name: 'Assobiador Experiente', tier: 4 },
  { minPoints: 800, name: 'Mestre Assobiador', tier: 5 },
  { minPoints: 1500, name: 'Grão-Mestre', tier: 6 },
  { minPoints: 3000, name: 'Lenda do Assobio', tier: 7 },
] as const;

export function calculateRank(points: number): string {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i]!.minPoints) {
      return RANKS[i]!.name;
    }
  }

  return RANKS[0]!.name;
}

export function getPointsForPlace(place: number): number {
  switch (place) {
    case 1:
      return POINTS_TABLE.regionalFirst;
    case 2:
      return POINTS_TABLE.regionalSecond;
    case 3:
      return POINTS_TABLE.regionalThird;
    default:
      return 0;
  }
}

export function getDailyHighlightPlacementPoints(place: number): number {
  switch (place) {
    case 1:
      return POINTS_TABLE.dailyHighlightFirst;
    case 2:
      return POINTS_TABLE.dailyHighlightSecond;
    case 3:
      return POINTS_TABLE.dailyHighlightThird;
    default:
      return 0;
  }
}

export function getBattleWinPoints(format: unknown): number {
  return format === 'duel' ? POINTS_TABLE.duelBattleWin : POINTS_TABLE.groupBattleWin;
}

export function getChampionshipPhaseAdvancePoints(scope: unknown): number {
  return scope === 'national'
    ? POINTS_TABLE.nationalPhaseAdvance
    : POINTS_TABLE.regionalPhaseAdvance;
}

export function getChampionshipPlacementPoints(scope: unknown, place: number): number {
  const national = scope === 'national';

  switch (place) {
    case 1:
      return national ? POINTS_TABLE.nationalFirst : POINTS_TABLE.regionalFirst;
    case 2:
      return national ? POINTS_TABLE.nationalSecond : POINTS_TABLE.regionalSecond;
    case 3:
      return national ? POINTS_TABLE.nationalThird : POINTS_TABLE.regionalThird;
    default:
      return 0;
  }
}

export function getPrizeForPlace(
  place: number,
  prizeDistribution?: { first: number; second: number; third: number } | null,
): number {
  if (!prizeDistribution) return 0;

  switch (place) {
    case 1:
      return prizeDistribution.first;
    case 2:
      return prizeDistribution.second;
    case 3:
      return prizeDistribution.third;
    default:
      return 0;
  }
}
