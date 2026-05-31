import type { PointActivity, SeasonRanking, User } from '@batalha/types';
import { calculateRank } from '@batalha/utils';

export type RankingScope = 'nacional' | 'regional';
export type RankingEntry = User | SeasonRanking;
export type RankingPeriod = 'allTime' | 'season' | 'weekly';

export type WeeklyRankingEntry = SeasonRanking & {
  weeklyPoints: number;
};

export function getUserRankingPoints(user: RankingEntry, seasonId: string | null) {
  if ('totalPoints' in user) return user.totalPoints;
  return seasonId ? (user.seasonPoints?.[seasonId]?.points ?? 0) : user.points;
}

export function getUserRankingRank(user: RankingEntry, seasonId: string | null) {
  return calculateRank(getUserRankingPoints(user, seasonId));
}

export function getUserRankingRegion(user: RankingEntry) {
  return user.state ?? user.birthState ?? null;
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
      scope === 'regional' && selectedState ? getUserRankingRegion(user) === selectedState : true,
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

function getBrazilDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

export function getBrazilWeekStart(date = new Date()) {
  const { year, month, day } = getBrazilDateParts(date);
  const brazilMidnightUtc = new Date(Date.UTC(year, month - 1, day, 3));
  const dayOfWeek = brazilMidnightUtc.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  return new Date(brazilMidnightUtc.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

export function shiftWeekStart(weekStart: Date, offsetWeeks: number) {
  return new Date(weekStart.getTime() + offsetWeeks * 7 * 24 * 60 * 60 * 1000);
}

export function getBrazilWeekEnd(weekStart: Date) {
  return shiftWeekStart(weekStart, 1);
}

export function getWeekId(weekStart: Date) {
  return weekStart.toISOString().slice(0, 10);
}

export function parseWeekId(value: string | null | undefined, fallback = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return getBrazilWeekStart(fallback);
  const parsed = new Date(`${value}T03:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return getBrazilWeekStart(fallback);
  return getBrazilWeekStart(parsed);
}

export function formatWeeklyRankingLabel(weekStart: Date) {
  const weekEnd = new Date(getBrazilWeekEnd(weekStart).getTime() - 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

function getRankingProfile(
  userId: string,
  profileByUserId: Map<string, SeasonRanking | User>,
): SeasonRanking {
  const profile = profileByUserId.get(userId);

  if (profile && 'totalPoints' in profile) {
    return profile;
  }

  if (profile) {
    return {
      id: userId,
      userId,
      seasonId: '',
      displayName: profile.displayName,
      username: profile.username ?? null,
      state: profile.state ?? null,
      birthState: profile.birthState ?? null,
      totalPoints: 0,
      xp: 0,
      rank: calculateRank(0),
      byCategory: {},
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    } as SeasonRanking;
  }

  return {
    id: userId,
    userId,
    seasonId: '',
    displayName: 'Assobiador',
    username: null,
    state: null,
    birthState: null,
    totalPoints: 0,
    xp: 0,
    rank: calculateRank(0),
    byCategory: {},
    createdAt: null,
    updatedAt: null,
  } as unknown as SeasonRanking;
}

export function getWeeklyRankingUsers({
  pointActivities,
  profiles,
  weekStart,
  limit,
}: {
  pointActivities: PointActivity[];
  profiles: Array<SeasonRanking | User>;
  weekStart: Date;
  limit?: number;
}): WeeklyRankingEntry[] {
  const weekEnd = getBrazilWeekEnd(weekStart);
  const profileByUserId = new Map<string, SeasonRanking | User>();
  profiles.forEach((profile) => {
    const userId = 'userId' in profile ? profile.userId : profile.id;
    profileByUserId.set(userId, profile);
  });

  const pointsByUserId = new Map<string, number>();
  pointActivities.forEach((activity) => {
    const occurredAt = getTimestampMillis(activity.occurredAt);
    if (occurredAt < weekStart.getTime() || occurredAt >= weekEnd.getTime()) return;
    pointsByUserId.set(activity.userId, (pointsByUserId.get(activity.userId) ?? 0) + activity.points);
  });

  const rows = Array.from(pointsByUserId.entries())
    .map(([userId, weeklyPoints]) => {
      const profile = getRankingProfile(userId, profileByUserId);
      return {
        ...profile,
        id: userId,
        userId,
        totalPoints: weeklyPoints,
        weeklyPoints,
        rank: calculateRank(weeklyPoints),
      };
    })
    .sort((a, b) => {
      const diff = b.weeklyPoints - a.weeklyPoints;
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName);
    });

  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}
