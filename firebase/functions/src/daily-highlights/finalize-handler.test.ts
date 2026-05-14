import { describe, expect, it, vi } from 'vitest';
import {
  finalizeDailyHighlightsForDay,
  finalizeDueDailyHighlights,
  getBrazilDayKey,
  getLatestFinalizableDailyHighlightDayKey,
} from './finalize-handler';
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

  it('only considers today finalizable after the Brazil 22:00 daily close', () => {
    expect(getLatestFinalizableDailyHighlightDayKey(new Date('2026-05-06T00:59:00.000Z'))).toBe(
      '2026-05-04',
    );
    expect(getLatestFinalizableDailyHighlightDayKey(new Date('2026-05-06T01:00:00.000Z'))).toBe(
      '2026-05-05',
    );
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

  it('writes point activity rows for daily top 3 placements', async () => {
    const updates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    const sets: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    const batch = {
      update: vi.fn((ref, data) => updates.push({ ref, data })),
      set: vi.fn((ref, data) => sets.push({ ref, data })),
      commit: vi.fn(async () => undefined),
    };
    const highlights = [
      {
        id: 'daily-1',
        userId: 'user-1',
        category: 'freestyle',
        voteCount: 8,
        createdAt: new Date('2026-05-05T10:00:00.000Z'),
      },
      {
        id: 'daily-2',
        userId: 'user-2',
        category: 'freestyle',
        voteCount: 4,
        createdAt: new Date('2026-05-05T11:00:00.000Z'),
      },
    ];
    const dailyQuery = {
      where: vi.fn(() => dailyQuery),
      get: vi.fn(async () => ({
        docs: highlights.map((highlight) => ({
          id: highlight.id,
          ref: { id: highlight.id },
          data: () => highlight,
        })),
      })),
    };
    const db = {
      batch: vi.fn(() => batch),
      doc: vi.fn((path: string) => ({ id: path.split('/').at(-1) ?? path, path })),
      collection: vi.fn((name: string) => {
        if (name === 'dailyHighlights') return dailyQuery;
        if (name === 'users') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn(async () => ({ data: () => ({ points: 0 }) })),
            })),
          };
        }
        if (name === 'pointActivities') {
          return { doc: vi.fn((id: string) => ({ id })) };
        }
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    await expect(
      finalizeDailyHighlightsForDay(db as never, { dayKey: '2026-05-05' }),
    ).resolves.toMatchObject({
      finalized: 2,
      winners: [
        { dailyHighlightId: 'daily-1', userId: 'user-1', place: 1, points: 15 },
        { dailyHighlightId: 'daily-2', userId: 'user-2', place: 2, points: 10 },
      ],
    });

    expect(sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({
            id: 'daily_highlight__daily-1__daily_highlight_placement__user-1',
          }),
          data: expect.objectContaining({
            userId: 'user-1',
            points: 15,
            reason: 'daily_highlight_placement',
            label: 'Top 1 em Destaques Diarios',
            sourceType: 'daily_highlight',
            sourceId: 'daily-1',
            seasonId: '2026',
          }),
        }),
      ]),
    );
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'user-1' }),
          data: expect.objectContaining({ points: expect.anything() }),
        }),
      ]),
    );
  });

  it('backfills overdue active daily highlight days and leaves the current open day alone', async () => {
    const activeDocs = [
      { id: 'old-1', dayKey: '2026-05-04', status: 'active' },
      { id: 'old-2', dayKey: '2026-05-05', status: 'active' },
      { id: 'today-open', dayKey: '2026-05-06', status: 'active' },
    ];
    const finalizeDocsByDay: Record<string, Array<Record<string, unknown>>> = {
      '2026-05-04': [
        {
          id: 'old-1',
          userId: 'user-1',
          category: 'freestyle',
          voteCount: 2,
          createdAt: new Date('2026-05-04T12:00:00.000Z'),
        },
      ],
      '2026-05-05': [
        {
          id: 'old-2',
          userId: 'user-2',
          category: 'melodia',
          voteCount: 1,
          createdAt: new Date('2026-05-05T12:00:00.000Z'),
        },
      ],
    };
    const batch = {
      update: vi.fn(),
      set: vi.fn(),
      commit: vi.fn(async () => undefined),
    };
    const activeQuery = {
      where: vi.fn(() => activeQuery),
      limit: vi.fn(() => activeQuery),
      get: vi.fn(async () => ({
        docs: activeDocs.map((doc) => ({
          id: doc.id,
          ref: { id: doc.id },
          data: () => doc,
        })),
      })),
    };
    let finalizeDayKey: string | null = null;
    const finalizeQuery = {
      where: vi.fn((field: string, _operator: string, value: string) => {
        if (field === 'dayKey') finalizeDayKey = value;
        return finalizeQuery;
      }),
      get: vi.fn(async () => {
        return {
          docs: (finalizeDocsByDay[finalizeDayKey ?? ''] ?? []).map((doc) => ({
            id: doc.id,
            ref: { id: doc.id },
            data: () => doc,
          })),
        };
      }),
    };
    const db = {
      batch: vi.fn(() => batch),
      doc: vi.fn((path: string) => ({ id: path.split('/').at(-1) ?? path, path })),
      collection: vi.fn((name: string) => {
        if (name === 'dailyHighlights') {
          return {
            where: vi.fn((field: string, operator: string, value: string) => {
              if (field === 'status' && value === 'active') return activeQuery;
              return finalizeQuery.where(field, operator, value);
            }),
          };
        }
        if (name === 'users') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn(async () => ({ data: () => ({ points: 0 }) })),
            })),
          };
        }
        if (name === 'pointActivities') return { doc: vi.fn((id: string) => ({ id })) };
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    await expect(
      finalizeDueDailyHighlights(db as never, {
        now: new Date('2026-05-06T00:59:00.000Z'),
      }),
    ).resolves.toMatchObject({
      latestFinalizableDayKey: '2026-05-04',
      finalizedDays: 1,
      finalized: 1,
    });
  });
});
