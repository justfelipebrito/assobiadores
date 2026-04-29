export type BattleEntryMode = 'free' | 'paid';

export type BattleEntryDenialCode =
  | 'registration_closed'
  | 'battle_full'
  | 'already_joined'
  | 'payment_required'
  | 'payment_not_required';

export interface BattleEntryEligibilityInput {
  status: string;
  entryFee: number;
  maxParticipants: number;
  currentParticipants: number;
  hasExistingEntry: boolean;
  mode: BattleEntryMode;
}

export interface BattleEntryEligibilityResult {
  allowed: boolean;
  code?: BattleEntryDenialCode;
  message?: string;
}

export function checkBattleEntryEligibility({
  status,
  entryFee,
  maxParticipants,
  currentParticipants,
  hasExistingEntry,
  mode,
}: BattleEntryEligibilityInput): BattleEntryEligibilityResult {
  if (status !== 'registration') {
    return {
      allowed: false,
      code: 'registration_closed',
      message: 'Inscricoes encerradas',
    };
  }

  if (hasExistingEntry) {
    return {
      allowed: false,
      code: 'already_joined',
      message: 'Voce ja esta inscrito nesta batalha',
    };
  }

  if (maxParticipants > 0 && currentParticipants >= maxParticipants) {
    return {
      allowed: false,
      code: 'battle_full',
      message: 'Batalha lotada',
    };
  }

  if (mode === 'free' && entryFee > 0) {
    return {
      allowed: false,
      code: 'payment_required',
      message: 'Batalha paga, requer pagamento',
    };
  }

  if (mode === 'paid' && entryFee <= 0) {
    return {
      allowed: false,
      code: 'payment_not_required',
      message: 'Batalha gratuita, nao requer pagamento',
    };
  }

  return { allowed: true };
}
