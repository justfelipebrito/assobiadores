import type { Battle } from '@batalha/types';
import type { BattleEntry } from '@batalha/types';

export function getBattlePrizeAmount(battle: Pick<Battle, 'prizePool'>) {
  return battle.prizePool > 0 ? battle.prizePool : null;
}

export function getContestantBattles({
  battles,
  entries,
}: {
  battles: Battle[];
  entries: BattleEntry[];
}) {
  const contestantBattleIds = new Set(
    entries
      .filter((entry) => entry.status === 'confirmed')
      .map((entry) => entry.battleId),
  );

  return battles.filter((battle) => contestantBattleIds.has(battle.id));
}

export function getCreatedBattles({
  battles,
  userId,
}: {
  battles: Battle[];
  userId: string | null;
}) {
  if (!userId) return [];
  return battles.filter((battle) => battle.createdBy === userId);
}
