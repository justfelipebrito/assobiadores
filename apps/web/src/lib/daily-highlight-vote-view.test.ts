import { describe, expect, it } from 'vitest';
import {
  getDailyHighlightLikeForVisibleDay,
  getDailyHighlightVoteState,
} from './daily-highlight-vote-view';

describe('daily highlight vote view helpers', () => {
  it('allows voting when the user has no daily like document', () => {
    expect(getDailyHighlightVoteState({ highlightId: 'highlight-1', like: null })).toEqual({
      hasVotedToday: false,
      isSelectedVote: false,
      buttonLabel: 'Votar',
      canVote: true,
    });
  });

  it('marks the selected highlight after the user votes', () => {
    expect(
      getDailyHighlightVoteState({
        highlightId: 'highlight-1',
        like: {
          dailyHighlightId: 'highlight-1',
          userId: 'user-1',
          dayKey: '2026-05-05',
        },
      }),
    ).toMatchObject({
      hasVotedToday: true,
      isSelectedVote: true,
      buttonLabel: 'Seu voto',
      canVote: false,
    });
  });

  it('disables other entries after the user has voted today', () => {
    expect(
      getDailyHighlightVoteState({
        highlightId: 'highlight-2',
        like: {
          dailyHighlightId: 'highlight-1',
          userId: 'user-1',
          dayKey: '2026-05-05',
        },
      }),
    ).toMatchObject({
      hasVotedToday: true,
      isSelectedVote: false,
      buttonLabel: 'Votar',
      canVote: false,
    });
  });

  it('selects the like for the day currently visible in the highlights list', () => {
    const likes = [
      {
        dailyHighlightId: 'new-day-highlight',
        userId: 'user-1',
        dayKey: '2026-05-05',
      },
      {
        dailyHighlightId: 'visible-highlight',
        userId: 'user-1',
        dayKey: '2026-05-04',
      },
    ];

    expect(
      getDailyHighlightLikeForVisibleDay({
        likes,
        visibleDayKey: '2026-05-04',
      }),
    ).toEqual(likes[1]);
  });
});
