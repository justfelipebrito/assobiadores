import { describe, expect, it } from 'vitest';
import {
  buildInitialSeasonRanking,
  buildSeasonRankingIncrement,
  getSeasonRankingPath,
} from './season-ranking-service';

describe('season-ranking-service', () => {
  it('builds a zero-point ranking row for new users', () => {
    expect(
      buildInitialSeasonRanking({
        userId: 'user-1',
        seasonId: '2026',
        user: { displayName: 'Maria', username: 'maria', birthState: 'SP' },
      }),
    ).toMatchObject({
      id: 'user-1',
      userId: 'user-1',
      seasonId: '2026',
      displayName: 'Maria',
      username: 'maria',
      birthState: 'SP',
      totalPoints: 0,
      byCategory: {},
    });
  });

  it('uses unified season points while preserving category breakdown on increments', () => {
    const update = buildSeasonRankingIncrement({
      user: {
        displayName: 'Ana',
        username: 'ana',
        state: 'RJ',
        seasonPoints: { '2026': { points: 10 } },
      },
      seasonId: '2026',
      category: 'melodia',
      points: 15,
    });

    expect(update).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      state: 'RJ',
      rank: 'Iniciante',
    });
    expect(update.totalPoints).toEqual(expect.anything());
    expect(update['byCategory.melodia']).toEqual(expect.anything());
  });

  it('keeps the nested ranking path stable', () => {
    expect(getSeasonRankingPath('2026', 'user-1')).toBe('seasonRankings/2026/users/user-1');
  });
});
