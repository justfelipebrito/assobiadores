import { describe, expect, it } from 'vitest';
import {
  getQualifierEmptyMatchesCopy,
  getQualifierMatchStatusCopy,
  getQualifierRegistrationStateCopy,
  isActiveQualifierRegistration,
  sortQualifierMatches,
} from './qualifier-view';

describe('qualifier view helpers', () => {
  it('identifies active payment/registration records', () => {
    expect(isActiveQualifierRegistration({ status: 'pending_payment' })).toBe(true);
    expect(isActiveQualifierRegistration({ status: 'confirmed' })).toBe(true);
    expect(isActiveQualifierRegistration({ status: 'cancelled' })).toBe(false);
  });

  it('returns user-facing registration state copy', () => {
    expect(
      getQualifierRegistrationStateCopy({
        status: 'pending_payment',
        bracketStatus: 'registered',
      }).title,
    ).toBe('Pagamento pendente');
    expect(
      getQualifierRegistrationStateCopy({
        status: 'confirmed',
        bracketStatus: 'qualified',
      }).title,
    ).toBe('Classificado para o Regional');
    expect(
      getQualifierRegistrationStateCopy({
        status: 'confirmed',
        bracketStatus: 'waiting_draw',
      }).title,
    ).toBe('Aguardando sorteio');
  });

  it('sorts matches by round and date', () => {
    const matches = [
      { id: 'b', roundNumber: 2, scheduledFor: { seconds: 20 } },
      { id: 'c', roundNumber: 1, scheduledFor: { seconds: 30 } },
      { id: 'a', roundNumber: 1, scheduledFor: { seconds: 10 } },
    ];

    expect(sortQualifierMatches(matches as never).map((match) => match.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('maps match statuses and empty states', () => {
    expect(getQualifierMatchStatusCopy('submissions_open')).toBe('Envios abertos');
    expect(getQualifierMatchStatusCopy('walkover')).toBe('W.O.');
    expect(getQualifierEmptyMatchesCopy(null)).toBe(
      'Selecione uma inscrição para acompanhar sua chave.',
    );
    expect(
      getQualifierEmptyMatchesCopy({
        status: 'pending_payment',
        bracketStatus: 'registered',
      }),
    ).toBe('Finalize o Pix para entrar no sorteio das chaves.');
  });
});
