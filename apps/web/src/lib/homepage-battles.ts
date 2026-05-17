import { toDate } from '@batalha/utils';
import type { Battle } from '@batalha/types';

const HOMEPAGE_ACTIVE_BATTLE_STATUSES = ['registration', 'active', 'voting'] as const;

export function getHomepageBattleCards(battles: Battle[], limit = 8) {
  return battles
    .map((battle, index) => ({ battle, index }))
    .filter(({ battle }) => HOMEPAGE_ACTIVE_BATTLE_STATUSES.includes(battle.status as never))
    .sort((a, b) => {
      if (a.battle.type !== b.battle.type) return a.battle.type === 'official' ? -1 : 1;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ battle }) => battle);
}

export function getOfficialBattleCloseDate(battle: Battle) {
  if (battle.status === 'registration') return toDate(battle.registrationEnd);
  if (battle.status === 'voting') return toDate(battle.votingEnd);
  return null;
}

export function getHomepageOfficialBattleHeroItems({
  battles,
  now = new Date(),
  limit = 3,
}: {
  battles: Battle[];
  now?: Date;
  limit?: number;
}) {
  return battles
    .map((battle) => ({ battle, closeAt: getOfficialBattleCloseDate(battle) }))
    .filter((item): item is { battle: Battle; closeAt: Date } => {
      const closeAt = item.closeAt;
      return (
        item.battle.type === 'official' &&
        (item.battle.status === 'registration' || item.battle.status === 'voting') &&
        closeAt instanceof Date &&
        closeAt.getTime() > now.getTime()
      );
    })
    .sort((a, b) => {
      const closeDiff = a.closeAt.getTime() - b.closeAt.getTime();
      if (closeDiff !== 0) return closeDiff;
      return a.battle.title.localeCompare(b.battle.title);
    })
    .slice(0, limit)
    .map(({ battle }) => battle);
}

export function getOfficialBattleHeroActionLabel(battle: Pick<Battle, 'status'>) {
  if (battle.status === 'voting') return 'Votar';
  return 'Participar';
}
