import type { Championship } from '@batalha/types';

const ACTIVE_CHAMPIONSHIP_STATUSES = ['upcoming', 'registration', 'active'];
const HOMEPAGE_REGIONAL_PRIORITY = ['SP', 'MG', 'RJ', 'BA', 'RS'];

function getParticipantCount(championship: Championship) {
  return Math.max(championship.currentParticipants ?? 0, championship.participantIds?.length ?? 0);
}

function getRegionalPriority(region: string | null | undefined) {
  const index = region ? HOMEPAGE_REGIONAL_PRIORITY.indexOf(region) : -1;
  return index === -1 ? HOMEPAGE_REGIONAL_PRIORITY.length : index;
}

export function sortChampionshipsForDisplay(championships: Championship[]) {
  return [...championships].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'national' ? -1 : 1;

    const regionCompare = (a.region ?? '').localeCompare(b.region ?? '');
    if (regionCompare !== 0) return regionCompare;

    return a.category.localeCompare(b.category);
  });
}

export function getVisibleHomepageChampionships(championships: Championship[], limit = 20) {
  return championships
    .filter(
      (championship) =>
        ACTIVE_CHAMPIONSHIP_STATUSES.includes(championship.status) &&
        (championship.scope === 'national' ||
          HOMEPAGE_REGIONAL_PRIORITY.includes(championship.region ?? '')),
    )
    .sort((a, b) => {
      const participantDiff = getParticipantCount(b) - getParticipantCount(a);
      if (participantDiff !== 0) return participantDiff;

      if (a.scope !== b.scope) return a.scope === 'national' ? -1 : 1;

      const regionDiff = getRegionalPriority(a.region) - getRegionalPriority(b.region);
      if (regionDiff !== 0) return regionDiff;

      return a.category.localeCompare(b.category);
    })
    .slice(0, limit);
}

export function getChampionshipParticipantIds(championship: Championship | null) {
  return championship?.participantIds ?? [];
}
