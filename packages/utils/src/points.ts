export const POINTS_TABLE = {
  first: 100,
  second: 70,
  third: 50,
  participation: 10,
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
      return POINTS_TABLE.first;
    case 2:
      return POINTS_TABLE.second;
    case 3:
      return POINTS_TABLE.third;
    default:
      return POINTS_TABLE.participation;
  }
}

export function getRankTier(points: number): number {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i]!.minPoints) {
      return RANKS[i]!.tier;
    }
  }
  return 1;
}
