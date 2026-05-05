import { describe, expect, it } from 'vitest';
import {
  DAILY_HIGHLIGHTS_MIN_DAY_KEY,
  formatBrazilDayKey,
  getBrazilDayKey,
  getDailyHighlightDayKeys,
  getDailyHighlightsForDay,
  getVisibleDailyHighlights,
  shiftBrazilDayKey,
} from './daily-highlight-view';

const now = new Date('2026-05-04T12:00:00.000Z');

function highlight(input: {
  id: string;
  createdAt: string;
  voteCount: number;
  status?: 'active' | 'hidden' | 'finalized';
  placement?: number;
  dayKey?: string;
}) {
  return {
    id: input.id,
    status: input.status ?? 'active',
    dayKey: input.dayKey ?? input.createdAt.slice(0, 10),
    voteCount: input.voteCount,
    placement: input.placement,
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

  it('uses the Brazil day key instead of the local browser day', () => {
    expect(getBrazilDayKey(new Date('2026-05-05T02:59:00.000Z'))).toBe('2026-05-04');
    expect(getBrazilDayKey(new Date('2026-05-05T03:00:00.000Z'))).toBe('2026-05-05');
  });

  it('formats Brazil day keys for pt-BR UI copy', () => {
    expect(formatBrazilDayKey('2026-05-05')).toBe('05/05/2026');
  });

  it('moves Brazil day keys by calendar day', () => {
    expect(shiftBrazilDayKey('2026-05-01', -1)).toBe('2026-04-30');
    expect(shiftBrazilDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('documents the earliest day available in the daily highlights archive', () => {
    expect(DAILY_HIGHLIGHTS_MIN_DAY_KEY).toBe('2026-05-01');
  });

  it('returns available day keys newest first without future days', () => {
    expect(
      getDailyHighlightDayKeys(
        [
          highlight({ id: 'future', dayKey: '2026-05-06', createdAt: '2026-05-06T09:00:00.000Z', voteCount: 9 }),
          highlight({ id: 'today', dayKey: '2026-05-05', createdAt: '2026-05-05T09:00:00.000Z', voteCount: 3 }),
          highlight({ id: 'old', dayKey: '2026-05-04', createdAt: '2026-05-04T09:00:00.000Z', voteCount: 2 }),
          highlight({ id: 'old-2', dayKey: '2026-05-04', createdAt: '2026-05-04T10:00:00.000Z', voteCount: 1 }),
        ],
        '2026-05-05',
      ),
    ).toEqual(['2026-05-05', '2026-05-04']);
  });

  it('shows only finalized top three entries when viewing a previous day', () => {
    const result = getDailyHighlightsForDay({
      dayKey: '2026-05-03',
      todayKey: '2026-05-04',
      highlights: [
        highlight({
          id: 'today',
          dayKey: '2026-05-04',
          createdAt: '2026-05-04T09:00:00.000Z',
          voteCount: 50,
        }),
        highlight({
          id: 'old-active',
          dayKey: '2026-05-03',
          createdAt: '2026-05-03T08:00:00.000Z',
          voteCount: 99,
        }),
        highlight({
          id: 'winner-2',
          dayKey: '2026-05-03',
          createdAt: '2026-05-03T10:00:00.000Z',
          voteCount: 5,
          status: 'finalized',
          placement: 2,
        }),
        highlight({
          id: 'winner-1',
          dayKey: '2026-05-03',
          createdAt: '2026-05-03T09:00:00.000Z',
          voteCount: 4,
          status: 'finalized',
          placement: 1,
        }),
        highlight({
          id: 'winner-4',
          dayKey: '2026-05-03',
          createdAt: '2026-05-03T12:00:00.000Z',
          voteCount: 2,
          status: 'finalized',
          placement: 4,
        }),
        highlight({
          id: 'winner-3',
          dayKey: '2026-05-03',
          createdAt: '2026-05-03T11:00:00.000Z',
          voteCount: 3,
          status: 'finalized',
          placement: 3,
        }),
      ],
    });

    expect(result.map((item) => item.id)).toEqual(['winner-1', 'winner-2', 'winner-3']);
  });
});
