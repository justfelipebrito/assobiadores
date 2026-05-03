import type { Championship } from '@batalha/types';

const ACTIVE_CHAMPIONSHIP_STATUSES = ['upcoming', 'registration', 'active'];

export function sortChampionshipsForDisplay(championships: Championship[]) {
  return [...championships].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'national' ? -1 : 1;

    const regionCompare = (a.region ?? '').localeCompare(b.region ?? '');
    if (regionCompare !== 0) return regionCompare;

    return a.category.localeCompare(b.category);
  });
}

export function getVisibleHomepageChampionships(championships: Championship[], limit = 20) {
  return sortChampionshipsForDisplay(
    championships.filter((championship) =>
      ACTIVE_CHAMPIONSHIP_STATUSES.includes(championship.status),
    ),
  ).slice(0, limit);
}

export function getChampionshipParticipantIds(championship: Championship | null) {
  return championship?.participantIds ?? [];
}
