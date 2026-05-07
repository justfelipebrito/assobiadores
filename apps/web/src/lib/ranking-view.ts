import type { SeasonRanking, User } from '@batalha/types';

export type RankingScope = 'nacional' | 'regional';
export type RankingEntry = User | SeasonRanking;

export function getUserRankingPoints(user: RankingEntry, seasonId: string | null) {
  if ('totalPoints' in user) return user.totalPoints;
  return seasonId ? (user.seasonPoints?.[seasonId]?.points ?? 0) : user.points;
}

export function getUserRankingRank(user: RankingEntry, seasonId: string | null) {
  if ('totalPoints' in user) return user.rank;
  return seasonId ? (user.seasonPoints?.[seasonId]?.rank ?? 'Iniciante') : user.rank;
}

export function getRankingUsers({
  users,
  scope,
  selectedState,
  seasonId,
}: {
  users: RankingEntry[];
  scope: RankingScope;
  selectedState: string;
  seasonId: string | null;
}) {
  return users
    .filter((user) =>
      scope === 'regional' && selectedState ? user.state === selectedState : true,
    )
    .sort((a, b) => {
      const diff = getUserRankingPoints(b, seasonId) - getUserRankingPoints(a, seasonId);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName);
    });
}

export function paginateRankingUsers<T>({
  users,
  page,
  pageSize,
}: {
  users: T[];
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    totalPages,
    pageSize,
    totalItems: users.length,
    items: users.slice(start, start + pageSize),
  };
}
