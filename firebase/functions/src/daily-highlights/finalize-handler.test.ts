import { describe, expect, it } from 'vitest';
import { getBrazilDayKey } from './finalize-handler';
import { getDailyHighlightPlacementPoints } from '../domain/ranking';

function sortForDailyResult<T extends { id: string; voteCount: number; createdAt: Date }>(
  highlights: T[],
) {
  return [...highlights].sort((a, b) => {
    const voteDiff = b.voteCount - a.voteCount;
    if (voteDiff !== 0) return voteDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

describe('daily highlight finalization helpers', () => {
  it('uses the Brazil day key for scheduled daily closure', () => {
    expect(getBrazilDayKey(new Date('2026-05-05T02:59:00.000Z'))).toBe('2026-05-04');
    expect(getBrazilDayKey(new Date('2026-05-05T03:00:00.000Z'))).toBe('2026-05-05');
  });

  it('selects top 3 by votes and first submission as tie-breaker', () => {
    const ordered = sortForDailyResult([
      { id: 'late-tied', voteCount: 5, createdAt: new Date('2026-05-05T13:00:00.000Z') },
      { id: 'first', voteCount: 10, createdAt: new Date('2026-05-05T10:00:00.000Z') },
      { id: 'early-tied', voteCount: 5, createdAt: new Date('2026-05-05T11:00:00.000Z') },
      { id: 'fourth', voteCount: 1, createdAt: new Date('2026-05-05T09:00:00.000Z') },
    ]);

    expect(ordered.slice(0, 3).map((highlight) => highlight.id)).toEqual([
      'first',
      'early-tied',
      'late-tied',
    ]);
  });

  it('uses the daily highlight placement scoring table', () => {
    expect([1, 2, 3, 4].map(getDailyHighlightPlacementPoints)).toEqual([15, 10, 5, 0]);
  });
});
