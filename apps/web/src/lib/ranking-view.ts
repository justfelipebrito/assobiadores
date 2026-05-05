import type { CompetitionCategory, User } from '@batalha/types';

export type RankingScope = 'nacional' | 'regional';

export function getUserRankingPoints(
  user: User,
  seasonId: string | null,
  category: CompetitionCategory,
) {
  return seasonId ? (user.seasonCategoryPoints?.[seasonId]?.[category]?.points ?? 0) : user.points;
}

export function getUserRankingRank(
  user: User,
  seasonId: string | null,
  category: CompetitionCategory,
) {
  return seasonId
    ? (user.seasonCategoryPoints?.[seasonId]?.[category]?.rank ?? 'Iniciante')
    : user.rank;
}

export function getRankingUsers({
  users,
  scope,
  selectedState,
  seasonId,
  category,
}: {
  users: User[];
  scope: RankingScope;
  selectedState: string;
  seasonId: string | null;
  category: CompetitionCategory;
}) {
  return users
    .filter((user) =>
      scope === 'regional' && selectedState ? user.state === selectedState : true,
    )
    .sort((a, b) => {
      const diff =
        getUserRankingPoints(b, seasonId, category) - getUserRankingPoints(a, seasonId, category);
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
