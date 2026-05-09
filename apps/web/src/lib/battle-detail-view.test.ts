import { describe, expect, it } from 'vitest';
import {
  canSubmitBattleEntry,
  getBattleRuleCards,
  getBattleScheduleItems,
  getBattleSubmissionResultBreakdown,
  sortBattleEntriesByCreatedAt,
  sortBattleSubmissionsByVoteCount,
  sortBattleSubmissionsForResult,
  sortBattleEntriesForDisplay,
} from './battle-detail-view';

describe('battle detail view helpers', () => {
  const battle = {
    status: 'registration',
    format: 'group',
    entryFee: 500,
    submissionDeadline: new Date('2026-05-07T12:00:00.000Z'),
    votingStart: new Date('2026-05-07T13:00:00.000Z'),
    votingEnd: new Date('2026-05-08T12:00:00.000Z'),
  } as const;

  it('uses submission and voting dates without showing registration deadline', () => {
    expect(getBattleScheduleItems(battle).map((item) => item.label)).toEqual([
      'Envios até',
      'Votação inicia',
      'Votação encerra',
    ]);
  });

  it('adds the prize rule only for paid battles', () => {
    expect(getBattleRuleCards(battle)).toEqual([
      {
        title: 'Votação',
        description:
          'Comunidade decide o resultado. Em empate, o criador desempata. Participantes não votam.',
      },
      {
        title: 'Prêmio',
        description: '80% do valor total do pagamento da taxa de entrada.',
      },
    ]);

    expect(getBattleRuleCards({ ...battle, entryFee: 0 })).toHaveLength(1);
  });

  it('allows confirmed participants to submit during registration or active status before the deadline', () => {
    expect(
      canSubmitBattleEntry({
        battle,
        hasConfirmedEntry: true,
        hasSubmission: false,
        now: new Date('2026-05-07T11:59:00.000Z'),
      }),
    ).toBe(true);
    expect(
      canSubmitBattleEntry({
        battle: { ...battle, status: 'active' },
        hasConfirmedEntry: true,
        hasSubmission: false,
        now: new Date('2026-05-07T11:59:00.000Z'),
      }),
    ).toBe(true);
  });

  it('hides submit when the user has no entry, already submitted, or the deadline passed', () => {
    expect(
      canSubmitBattleEntry({
        battle,
        hasConfirmedEntry: false,
        hasSubmission: false,
      }),
    ).toBe(false);
    expect(
      canSubmitBattleEntry({
        battle,
        hasConfirmedEntry: true,
        hasSubmission: true,
      }),
    ).toBe(false);
    expect(
      canSubmitBattleEntry({
        battle,
        hasConfirmedEntry: true,
        hasSubmission: false,
        now: new Date('2026-05-07T12:01:00.000Z'),
      }),
    ).toBe(false);
  });

  it('orders finished battle winner first and the remaining participants by vote count', () => {
    const entries = [
      { id: 'entry-4', userId: 'user-4' },
      { id: 'entry-2', userId: 'user-2' },
      { id: 'entry-1', userId: 'user-1' },
      { id: 'entry-3', userId: 'user-3' },
    ] as never[];

    expect(
      sortBattleEntriesForDisplay({
        battle: {
          status: 'finished',
          winners: [
            { userId: 'user-1', place: 1 },
            { userId: 'legacy-second-place', place: 2 },
          ],
        } as never,
        entries,
        submissionsByUserId: new Map([
          ['user-2', { voteCount: 8 }],
          ['user-3', { voteCount: 2 }],
          ['user-4', { voteCount: 12 }],
        ]) as never,
      }).map((entry) => entry.userId),
    ).toEqual(['user-1', 'user-4', 'user-2', 'user-3']);
  });

  it('orders battle participants by creation date without requiring Firestore orderBy', () => {
    const entries = [
      { id: 'entry-2', createdAt: new Date('2026-05-07T12:02:00.000Z') },
      { id: 'entry-1', createdAt: new Date('2026-05-07T12:01:00.000Z') },
      { id: 'entry-3', createdAt: new Date('2026-05-07T12:03:00.000Z') },
    ] as never[];

    expect(sortBattleEntriesByCreatedAt(entries).map((entry) => entry.id)).toEqual([
      'entry-1',
      'entry-2',
      'entry-3',
    ]);
  });

  it('orders battle submissions by vote count in memory so Firestore does not need a composite ordered query', () => {
    const submissions = [
      { id: 'sub-1', voteCount: 1 },
      { id: 'sub-3', voteCount: 3 },
      { id: 'sub-2', voteCount: 2 },
    ] as never[];

    expect(sortBattleSubmissionsByVoteCount(submissions).map((submission) => submission.id)).toEqual([
      'sub-3',
      'sub-2',
      'sub-1',
    ]);
  });

  it('orders finished battle submissions by winner first and community votes after', () => {
    const submissions = [
      { id: 'sub-2', userId: 'user-2', voteCount: 8 },
      { id: 'sub-3', userId: 'user-3', voteCount: 2 },
      { id: 'sub-1', userId: 'user-1', voteCount: 4 },
      { id: 'sub-4', userId: 'user-4', voteCount: 12 },
    ] as never[];

    expect(
      sortBattleSubmissionsForResult({
        battle: {
          status: 'finished',
          winners: [{ userId: 'user-1', place: 1 }],
        } as never,
        submissions,
      }).map((submission) => submission.userId),
    ).toEqual(['user-1', 'user-4', 'user-2', 'user-3']);
  });

  it('separates community votes from the creator vote signal', () => {
    expect(
      getBattleSubmissionResultBreakdown({
        voteCount: 8,
        publicVoteCount: 7,
        judgeVoteCount: 1,
      }),
    ).toEqual({ publicVoteCount: 7, hasCreatorVote: true });

    expect(getBattleSubmissionResultBreakdown({ voteCount: 4 })).toEqual({
      publicVoteCount: 4,
      hasCreatorVote: false,
    });
  });
});
