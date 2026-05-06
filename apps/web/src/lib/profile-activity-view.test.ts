import { describe, expect, it } from 'vitest';
import { getPointActivitySecondaryText, getPublicProfileStats } from './profile-activity-view';

const baseUser = {
  id: 'user-1',
  points: 0,
  stats: {
    battlesEntered: 0,
    battlesWon: 0,
    totalVotesReceived: 0,
    topThreeFinishes: 0,
  },
} as any;

describe('profile activity view', () => {
  it('derives public profile counters from real entries, submissions, highlights, and ledger rows', () => {
    const stats = getPublicProfileStats({
      user: baseUser,
      battleEntries: [
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-1', status: 'pending_payment' },
      ] as any,
      submissions: [{ voteCount: 7 }, { voteCount: 3 }] as any,
      dailyHighlights: [
        { voteCount: 4, placement: 1 },
        { voteCount: 2, placement: null },
      ] as any,
      pointActivities: [
        { reason: 'battle_win' },
        { reason: 'daily_highlight_submission' },
      ] as any,
    });

    expect(stats).toEqual({
      battlesEntered: 1,
      battlesWon: 1,
      topThreeFinishes: 1,
      totalVotesReceived: 16,
    });
  });

  it('keeps server aggregates when they are higher than locally loaded records', () => {
    const stats = getPublicProfileStats({
      user: {
        ...baseUser,
        stats: {
          battlesEntered: 12,
          battlesWon: 3,
          totalVotesReceived: 99,
          topThreeFinishes: 4,
        },
      },
      battleEntries: [],
      submissions: [],
      dailyHighlights: [],
      pointActivities: [],
    });

    expect(stats).toMatchObject({
      battlesEntered: 12,
      battlesWon: 3,
      totalVotesReceived: 99,
      topThreeFinishes: 4,
    });
  });

  it('formats activity source metadata without empty separators', () => {
    expect(
      getPointActivitySecondaryText({
        sourceTitle: 'Batalha Local',
        category: 'freestyle',
      } as any),
    ).toBe('Batalha Local · freestyle');

    expect(getPointActivitySecondaryText({ sourceTitle: null, category: null } as any)).toBe('');
  });
});
