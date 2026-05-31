import { describe, expect, it } from 'vitest';
import {
  formatWeeklyRankingLabel,
  getBrazilWeekEnd,
  getBrazilWeekStart,
  getRankingUsers,
  getUserRankingRank,
  getUserRankingRegion,
  getWeekId,
  getWeeklyRankingUsers,
  paginateRankingUsers,
  parseWeekId,
  shiftWeekStart,
} from './ranking-view';
import type { PointActivity, User } from '@batalha/types';

function user(id: string, state: string, points: number): User {
  return {
    id,
    displayName: id,
    state,
    points,
    rank: 'Iniciante',
    seasonCategoryPoints: {
      season_2026: {
        freestyle: {
          points,
          xp: 0,
          casualPoints: 0,
          rank: 'Iniciante',
        },
      },
    },
  } as unknown as User;
}

describe('getRankingUsers', () => {
  it('does not cap the ranking after filtering', () => {
    const users = Array.from({ length: 80 }, (_, index) =>
      user(`user-${String(index + 1).padStart(2, '0')}`, 'SP', 1000 - index),
    );

    const result = getRankingUsers({
      users,
      scope: 'regional',
      selectedState: 'SP',
      seasonId: 'season_2026',
    });

    expect(result).toHaveLength(80);
    expect(result[0]?.id).toBe('user-01');
    expect(result[79]?.id).toBe('user-80');
  });

  it('filters by selected regional state before sorting', () => {
    const result = getRankingUsers({
      users: [user('sp-low', 'SP', 10), user('rj-high', 'RJ', 100), user('sp-high', 'SP', 50)],
      scope: 'regional',
      selectedState: 'SP',
      seasonId: 'season_2026',
    });

    expect(result.map((rankingUser) => rankingUser.id)).toEqual(['sp-high', 'sp-low']);
  });

  it('uses birthState as the regional ranking fallback', () => {
    const result = getRankingUsers({
      users: [
        { ...user('birth-sp', '', 10), state: null, birthState: 'SP' } as User,
        { ...user('birth-rj', '', 50), state: null, birthState: 'RJ' } as User,
      ],
      scope: 'regional',
      selectedState: 'SP',
      seasonId: 'season_2026',
    });

    expect(result.map((rankingUser) => rankingUser.id)).toEqual(['birth-sp']);
    expect(getUserRankingRegion(result[0]!)).toBe('SP');
  });

  it('paginates after filtering without removing items from the overall result', () => {
    const users = Array.from({ length: 123 }, (_, index) => user(`user-${index + 1}`, 'SP', index));

    const page = paginateRankingUsers({
      users,
      page: 3,
      pageSize: 50,
    });

    expect(page.totalItems).toBe(123);
    expect(page.totalPages).toBe(3);
    expect(page.items).toHaveLength(23);
    expect(page.items[0]?.id).toBe('user-101');
  });

  it('uses unified season totals across categories', () => {
    const result = getRankingUsers({
      users: [
        {
          ...user('split-category', 'SP', 0),
          seasonPoints: { season_2026: { points: 20, xp: 0, casualPoints: 0, rank: 'Iniciante' } },
          seasonCategoryPoints: {
            season_2026: {
              melodia: { points: 10, xp: 0, casualPoints: 0, rank: 'Iniciante' },
              passaros: { points: 10, xp: 0, casualPoints: 0, rank: 'Iniciante' },
            },
          },
        } as User,
        user('single-category', 'SP', 15),
      ],
      scope: 'nacional',
      selectedState: '',
      seasonId: 'season_2026',
    });

    expect(result.map((rankingUser) => rankingUser.id)).toEqual([
      'split-category',
      'single-category',
    ]);
  });

  it('derives the visible rank label from points to avoid stale rank text', () => {
    expect(
      getUserRankingRank(
        {
          ...user('stale-rank', 'SP', 0),
          rank: 'Iniciante',
          totalPoints: 200,
        } as unknown as User,
        null,
      ),
    ).toBe('Assobiador');
  });

  it('builds Brazil-time weekly windows and week ids', () => {
    const weekStart = getBrazilWeekStart(new Date('2026-05-23T12:00:00.000Z'));

    expect(getWeekId(weekStart)).toBe('2026-05-18');
    expect(getWeekId(getBrazilWeekEnd(weekStart))).toBe('2026-05-25');
    expect(getWeekId(shiftWeekStart(weekStart, -1))).toBe('2026-05-11');
    expect(getWeekId(parseWeekId('2026-05-18'))).toBe('2026-05-18');
    expect(formatWeeklyRankingLabel(weekStart)).toContain('18');
  });

  it('aggregates weekly ranking points from point activities', () => {
    const weekStart = getBrazilWeekStart(new Date('2026-05-23T12:00:00.000Z'));
    const activities = [
      {
        userId: 'user-a',
        points: 10,
        occurredAt: new Date('2026-05-18T04:00:00.000Z'),
      },
      {
        userId: 'user-a',
        points: 5,
        occurredAt: new Date('2026-05-24T22:00:00.000Z'),
      },
      {
        userId: 'user-b',
        points: 30,
        occurredAt: new Date('2026-05-20T10:00:00.000Z'),
      },
      {
        userId: 'user-c',
        points: 999,
        occurredAt: new Date('2026-05-25T03:00:00.000Z'),
      },
    ] as PointActivity[];

    const result = getWeeklyRankingUsers({
      pointActivities: activities,
      profiles: [user('user-a', 'SP', 100), user('user-b', 'RJ', 200)],
      weekStart,
    });

    expect(result.map((rankingUser) => [rankingUser.userId, rankingUser.weeklyPoints])).toEqual([
      ['user-b', 30],
      ['user-a', 15],
    ]);
    expect(result[0]?.displayName).toBe('user-b');
  });
});
