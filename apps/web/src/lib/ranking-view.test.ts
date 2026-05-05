import { describe, expect, it } from 'vitest';
import { getRankingUsers, paginateRankingUsers } from './ranking-view';
import type { User } from '@batalha/types';

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
      category: 'freestyle',
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
      category: 'freestyle',
    });

    expect(result.map((rankingUser) => rankingUser.id)).toEqual(['sp-high', 'sp-low']);
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
});
