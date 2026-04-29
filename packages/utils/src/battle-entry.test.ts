import { describe, expect, it } from 'vitest';
import { checkBattleEntryEligibility } from './battle-entry';

const baseInput = {
  status: 'registration',
  entryFee: 0,
  maxParticipants: 10,
  currentParticipants: 3,
  hasExistingEntry: false,
  mode: 'free' as const,
};

describe('checkBattleEntryEligibility', () => {
  it('allows free entry when registration is open and capacity is available', () => {
    expect(checkBattleEntryEligibility(baseInput)).toEqual({ allowed: true });
  });

  it('denies entries outside registration phase', () => {
    expect(checkBattleEntryEligibility({ ...baseInput, status: 'active' })).toMatchObject({
      allowed: false,
      code: 'registration_closed',
    });
  });

  it('denies duplicate entries', () => {
    expect(checkBattleEntryEligibility({ ...baseInput, hasExistingEntry: true })).toMatchObject({
      allowed: false,
      code: 'already_joined',
    });
  });

  it('denies entries when the battle is full', () => {
    expect(
      checkBattleEntryEligibility({
        ...baseInput,
        maxParticipants: 3,
        currentParticipants: 3,
      }),
    ).toMatchObject({
      allowed: false,
      code: 'battle_full',
    });
  });

  it('treats zero max participants as unlimited capacity', () => {
    expect(
      checkBattleEntryEligibility({
        ...baseInput,
        maxParticipants: 0,
        currentParticipants: 100,
      }),
    ).toEqual({ allowed: true });
  });

  it('requires payment mode for paid battles', () => {
    expect(checkBattleEntryEligibility({ ...baseInput, entryFee: 500 })).toMatchObject({
      allowed: false,
      code: 'payment_required',
    });
  });

  it('rejects payment mode for free battles', () => {
    expect(
      checkBattleEntryEligibility({
        ...baseInput,
        mode: 'paid',
      }),
    ).toMatchObject({
      allowed: false,
      code: 'payment_not_required',
    });
  });

  it('allows paid entry checks for paid battles', () => {
    expect(
      checkBattleEntryEligibility({
        ...baseInput,
        entryFee: 500,
        mode: 'paid',
      }),
    ).toEqual({ allowed: true });
  });
});
