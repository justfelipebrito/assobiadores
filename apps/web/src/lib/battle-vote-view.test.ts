import { describe, expect, it } from 'vitest';
import {
  getBattleSubmissionVoteState,
  getBattleVoteForUser,
  getBattleWinnerBadgeLabel,
  getBattleWinnerForSubmission,
} from './battle-vote-view';

describe('battle vote view helpers', () => {
  it('marks the submission selected by the logged voter', () => {
    const vote = { submissionId: 'submission-1' } as never;

    expect(
      getBattleSubmissionVoteState({
        submissionId: 'submission-1',
        currentVote: vote,
        canVote: true,
      }),
    ).toEqual({ isSelectedVote: true, canVote: false, buttonLabel: 'Votar' });

    expect(
      getBattleSubmissionVoteState({
        submissionId: 'submission-2',
        currentVote: vote,
        canVote: true,
      }),
    ).toEqual({ isSelectedVote: false, canVote: false, buttonLabel: 'Votar' });
  });

  it('allows voting only while the user has not voted yet', () => {
    expect(
      getBattleSubmissionVoteState({
        submissionId: 'submission-1',
        currentVote: null,
        canVote: true,
      }),
    ).toEqual({ isSelectedVote: false, canVote: true, buttonLabel: 'Votar' });
  });

  it('reads the current user vote and winner metadata', () => {
    expect(getBattleVoteForUser([{ submissionId: 'submission-1' } as never])).toMatchObject({
      submissionId: 'submission-1',
    });

    expect(
      getBattleWinnerForSubmission({
        battle: { winners: [{ userId: 'user-1', place: 1, points: 20, prize: 500 }] },
        submission: { userId: 'user-1' },
      } as never),
    ).toMatchObject({ place: 1, points: 20, prize: 500 });

    expect(getBattleWinnerBadgeLabel(1)).toBe('Vencedor');
    expect(getBattleWinnerBadgeLabel(2)).toBe('2º lugar');
  });
});

