import { describe, expect, it } from 'vitest';
import {
  canSubmitBattleEntry,
  getBattleRuleCards,
  getBattleScheduleItems,
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
        description: 'Comunidade vale 70%; criador vale 30%. Participantes não votam.',
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
});

