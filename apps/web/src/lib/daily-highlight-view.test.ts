import { describe, expect, it } from 'vitest';
import { getVisibleDailyHighlights } from './daily-highlight-view';

const now = new Date('2026-05-04T12:00:00.000Z');

function highlight(input: {
  id: string;
  createdAt: string;
  voteCount: number;
  status?: 'active' | 'hidden';
}) {
  return {
    id: input.id,
    status: input.status ?? 'active',
    voteCount: input.voteCount,
    createdAt: new Date(input.createdAt),
  } as never;
}

describe('daily highlight view helpers', () => {
  it('uses only today entries and orders by votes first', () => {
    const result = getVisibleDailyHighlights({
      now,
      highlights: [
        highlight({ id: 'old', createdAt: '2026-05-03T12:00:00.000Z', voteCount: 99 }),
        highlight({ id: 'today-1', createdAt: '2026-05-04T09:00:00.000Z', voteCount: 2 }),
        highlight({ id: 'today-2', createdAt: '2026-05-04T10:00:00.000Z', voteCount: 5 }),
        highlight({ id: 'today-3', createdAt: '2026-05-04T11:00:00.000Z', voteCount: 1 }),
      ],
    });

    expect(result.map((item) => item.id)).toEqual(['today-2', 'today-1', 'today-3']);
  });

  it('does not fall back to previous days when today has fewer than three', () => {
    const result = getVisibleDailyHighlights({
      now,
      highlights: [
        highlight({ id: 'old-1', createdAt: '2026-05-03T12:00:00.000Z', voteCount: 3 }),
        highlight({ id: 'old-2', createdAt: '2026-05-03T13:00:00.000Z', voteCount: 1 }),
        highlight({ id: 'today-1', createdAt: '2026-05-04T09:00:00.000Z', voteCount: 2 }),
        highlight({
          id: 'hidden',
          createdAt: '2026-05-04T10:00:00.000Z',
          voteCount: 100,
          status: 'hidden',
        }),
      ],
    });

    expect(result.map((item) => item.id)).toEqual(['today-1']);
  });

  it('shows the first submitted entries first when votes are still zero', () => {
    const result = getVisibleDailyHighlights({
      now,
      limit: 3,
      highlights: [
        highlight({ id: 'third', createdAt: '2026-05-04T11:00:00.000Z', voteCount: 0 }),
        highlight({ id: 'first', createdAt: '2026-05-04T09:00:00.000Z', voteCount: 0 }),
        highlight({ id: 'fourth', createdAt: '2026-05-04T12:00:00.000Z', voteCount: 0 }),
        highlight({ id: 'second', createdAt: '2026-05-04T10:00:00.000Z', voteCount: 0 }),
      ],
    });

    expect(result.map((item) => item.id)).toEqual(['first', 'second', 'third']);
  });

  it('keeps deterministic ordering with thousands of zero-vote entries', () => {
    const highlights = Array.from({ length: 5000 }).map((_, index) =>
      highlight({
        id: `entry-${index + 1}`,
        createdAt: new Date(Date.UTC(2026, 4, 4, 0, 0, index)).toISOString(),
        voteCount: 0,
      }),
    );

    const result = getVisibleDailyHighlights({
      now,
      limit: 3,
      highlights,
    });

    expect(result.map((item) => item.id)).toEqual(['entry-1', 'entry-2', 'entry-3']);
  });
});
