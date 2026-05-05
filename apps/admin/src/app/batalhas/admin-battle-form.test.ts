import { describe, expect, it } from 'vitest';
import {
  battleToAdminFormValues,
  createDefaultAdminBattleFormValues,
  validateAdminBattleForm,
} from './admin-battle-form';
import type { Battle } from '@batalha/types';

const validValues = createDefaultAdminBattleFormValues(new Date('2026-01-01T12:00:00Z'));

describe('admin battle form helpers', () => {
  it('builds a valid payload from form values', () => {
    const result = validateAdminBattleForm({
      ...validValues,
      title: 'Batalha Nacional',
      description: 'Etapa classificatoria',
      rulesText: 'Uma regra\n\nOutra regra',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual(
      expect.objectContaining({
        title: 'Batalha Nacional',
        description: 'Etapa classificatoria',
        type: 'official',
        format: 'group',
        category: 'freestyle',
        status: 'draft',
        entryFee: 0,
        prizePool: 0,
        maxParticipants: 32,
        judges: [],
        rules: ['Uma regra', 'Outra regra'],
      }),
    );
  });

  it('does not let paid battle admin edits overwrite derived prize totals', () => {
    const result = validateAdminBattleForm({
      ...validValues,
      title: 'Batalha paga',
      entryFee: '500',
      prizePool: '99999',
    });

    expect(result.error).toBeNull();
    expect(result.payload).toEqual(
      expect.not.objectContaining({
        prizePool: expect.anything(),
      }),
    );
  });

  it('forces duel battles to two participants', () => {
    const result = validateAdminBattleForm({
      ...validValues,
      title: 'Duelo oficial',
      format: 'duel',
      maxParticipants: '50',
    });

    expect(result.error).toBeNull();
    expect(result.payload?.maxParticipants).toBe(2);
  });

  it('rejects invalid phase order', () => {
    const result = validateAdminBattleForm({
      ...validValues,
      title: 'Batalha invalida',
      votingEnd: validValues.votingStart,
    });

    expect(result.payload).toBeNull();
    expect(result.error).toBe('Fim da votacao precisa ser depois do inicio.');
  });

  it('maps an existing battle into editable form values', () => {
    const battle = {
      title: 'Batalha existente',
      description: '',
      type: 'community',
      format: 'duel',
      category: 'melodia',
      status: 'registration',
      entryFee: 10,
      prizePool: 100,
      maxParticipants: 2,
      votingType: 'public',
      registrationStart: { seconds: 1767268800 },
      registrationEnd: { seconds: 1767355200 },
      submissionDeadline: { seconds: 1767441600 },
      votingStart: { seconds: 1767445200 },
      votingEnd: { seconds: 1767528000 },
      rules: ['Sem edicao'],
    } as Battle;

    expect(battleToAdminFormValues(battle)).toEqual(
      expect.objectContaining({
        title: 'Batalha existente',
        type: 'community',
        format: 'duel',
        category: 'melodia',
        status: 'registration',
        rulesText: 'Sem edicao',
      }),
    );
  });
});
