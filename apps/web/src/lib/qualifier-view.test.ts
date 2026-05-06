import { describe, expect, it } from 'vitest';
import {
  getQualifierEmptyMatchesCopy,
  getDisplayQualifierRound,
  getQualifierMatchHeaderDateCopy,
  getQualifierMatchResultCopy,
  getQualifierMatchStatusCopy,
  getQualifierRegistrationStateCopy,
  getQualifierRuleCards,
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

  it('sorts same-date matches by match day and sequence', () => {
    const matches = [
      { id: 'c', roundNumber: 1, scheduledFor: { seconds: 10 }, matchDayIndex: 2, sequenceInDay: 1 },
      { id: 'b', roundNumber: 1, scheduledFor: { seconds: 10 }, matchDayIndex: 1, sequenceInDay: 2 },
      { id: 'a', roundNumber: 1, scheduledFor: { seconds: 10 }, matchDayIndex: 1, sequenceInDay: 1 },
    ];

    expect(sortQualifierMatches(matches as never).map((match) => match.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('defaults the displayed qualifier round to the latest available round', () => {
    expect(getDisplayQualifierRound([1, 2, 3], null)).toBe(3);
    expect(getDisplayQualifierRound([1, 2, 3], 2)).toBe(2);
    expect(getDisplayQualifierRound([1, 2, 3], 9)).toBe(3);
    expect(getDisplayQualifierRound([], null)).toBe(1);
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

  it('shows voting state instead of submission deadline when voting is open', () => {
    const formatDateTime = () => '05/05/2026, 22:22';

    expect(
      getQualifierMatchHeaderDateCopy(
        { status: 'voting', submissionDeadline: { seconds: 1 } } as never,
        formatDateTime,
      ),
    ).toBe('Votação em andamento');
    expect(
      getQualifierMatchHeaderDateCopy(
        { status: 'submissions_open', submissionDeadline: { seconds: 1 } } as never,
        formatDateTime,
      ),
    ).toBe('Envio até 05/05/2026, 22:22');
    expect(
      getQualifierMatchHeaderDateCopy(
        { status: 'walkover', submissionDeadline: { seconds: 1 } } as never,
        formatDateTime,
      ),
    ).toBe('Resultado por W.O.');
    expect(
      getQualifierMatchHeaderDateCopy(
        { status: 'finished', submissionDeadline: { seconds: 1 } } as never,
        formatDateTime,
      ),
    ).toBe('Confronto finalizado');
  });

  it('clarifies when a match winner has qualified for the Regional', () => {
    expect(getQualifierMatchResultCopy({ winnerName: null })).toEqual({
      title: 'Resultado',
      value: 'Aguardando',
      tone: 'muted',
    });
    expect(getQualifierMatchResultCopy({ winnerName: 'Assobiador 004' })).toEqual({
      title: 'Resultado',
      value: 'Assobiador 004',
      tone: 'default',
    });
    expect(
      getQualifierMatchResultCopy({
        winnerName: 'Assobiador 004',
        qualifiedForRegional: true,
      }),
    ).toEqual({
      title: 'Classificado para o Regional',
      value: 'Assobiador 004',
      tone: 'success',
    });
  });

  it('returns battle-style qualifier rule cards with the configured qualification cap', () => {
    expect(getQualifierRuleCards(32)).toEqual([
      {
        title: 'INSCRIÇÃO',
        description: 'A inscrição é vinculada à sua Naturalidade e categoria escolhida.',
      },
      {
        title: 'ENVIO',
        description: 'Em cada confronto, grave seu assobio na plataforma até 14:59.',
      },
      {
        title: 'VOTAÇÃO',
        description: 'Votação pública das 15:00 às 21:59. Participantes não votam.',
      },
      {
        title: 'CLASSIFICAÇÃO',
        description: 'Até 32 competidores avançam para o Regional da categoria.',
      },
    ]);
  });
});
