import { describe, expect, it } from 'vitest';
import { buildSeasonRankingIncrement, getSeasonRankingPath } from './season-ranking';

describe('functions season ranking aggregate', () => {
  it('builds unified ranking increments with category breakdown fields', () => {
    const update = buildSeasonRankingIncrement({
      user: {
        displayName: 'Assobiador Teste',
        username: 'assobiador',
        state: 'SP',
        seasonPoints: { '2026': { points: 20 } },
      },
      seasonId: '2026',
      category: 'passaros',
      points: 10,
    });

    expect(update).toMatchObject({
      displayName: 'Assobiador Teste',
      username: 'assobiador',
      state: 'SP',
      rank: 'Iniciante',
    });
    expect(update.totalPoints).toEqual(expect.anything());
    expect(update['byCategory.passaros']).toEqual(expect.anything());
  });

  it('keeps the nested aggregate path stable', () => {
    expect(getSeasonRankingPath('2026', 'user-1')).toBe('seasonRankings/2026/users/user-1');
  });
});
