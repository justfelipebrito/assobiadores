import { describe, expect, it } from 'vitest';
import { getBattlePrizeAmount, getContestantBattles, getCreatedBattles } from './battle-list-view';

describe('battle list view helpers', () => {
  it('shows only positive battle prize pools', () => {
    expect(getBattlePrizeAmount({ prizePool: 320 })).toBe(320);
    expect(getBattlePrizeAmount({ prizePool: 0 })).toBeNull();
  });

  it('returns only battles with confirmed contestant entries', () => {
    const battles = [
      { id: 'battle-1', title: 'One' },
      { id: 'battle-2', title: 'Two' },
      { id: 'battle-3', title: 'Three' },
    ] as never;
    const entries = [
      { battleId: 'battle-1', status: 'confirmed' },
      { battleId: 'battle-2', status: 'pending_payment' },
      { battleId: 'missing-battle', status: 'confirmed' },
    ] as never;

    expect(getContestantBattles({ battles, entries }).map((battle) => battle.id)).toEqual([
      'battle-1',
    ]);
  });

  it('returns only battles created by the user', () => {
    const battles = [
      { id: 'battle-1', createdBy: 'user-1' },
      { id: 'battle-2', createdBy: 'user-2' },
      { id: 'battle-3', createdBy: 'user-1' },
    ] as never;

    expect(getCreatedBattles({ battles, userId: 'user-1' }).map((battle) => battle.id)).toEqual([
      'battle-1',
      'battle-3',
    ]);
    expect(getCreatedBattles({ battles, userId: null })).toEqual([]);
  });
});
