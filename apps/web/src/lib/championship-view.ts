import type { Championship } from '@batalha/types';

const ACTIVE_CHAMPIONSHIP_STATUSES = ['upcoming', 'registration', 'active'];
const HOMEPAGE_REGIONAL_PRIORITY = ['SP', 'MG', 'RJ', 'BA', 'RS'];
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export const OFFICIAL_2026_QUALIFIER_REGISTRATION_START = new Date('2026-06-01T00:00:00-03:00');
export const OFFICIAL_2026_QUALIFIER_END = new Date('2026-07-12T23:59:59-03:00');

export function getChampionshipParticipantCount(championship: Championship) {
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
      const participantDiff =
        getChampionshipParticipantCount(b) - getChampionshipParticipantCount(a);
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

export function getChampionshipEmptyParticipantsCopy(championship: Championship) {
  if (championship.scope === 'national') {
    return 'Ainda não há participantes classificados, os top 10 das regionais serão automaticamente classificados.';
  }

  return 'Ainda não há participantes classificados, até 64 participantes serão classificados através das Classificatórias.';
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
}

export function formatOfficialDate(value: unknown) {
  const date = toDate(value);
  return date ? DATE_FORMATTER.format(date) : '';
}

export function getChampionshipStatusCopy(championship: Championship, now = new Date()) {
  const start = toDate(championship.schedule.start);
  const end = toDate(championship.schedule.end);

  if (championship.scope === 'national') {
    if (start && now >= start && end && now <= end) return 'Status: Nacional em andamento';
    if (end && now > end) return 'Status: Nacional finalizado';
    return 'Status: Classificados do Regional';
  }

  if (now < OFFICIAL_2026_QUALIFIER_REGISTRATION_START) {
    return `Status: Classificatórias abrem em ${formatOfficialDate(
      OFFICIAL_2026_QUALIFIER_REGISTRATION_START,
    )}`;
  }

  if (now <= OFFICIAL_2026_QUALIFIER_END) {
    return 'Status: Classificatórias em andamento';
  }

  if (start && now < start) {
    return `Status: Regional começa em ${formatOfficialDate(start)}`;
  }

  if (end && now <= end) {
    return 'Status: Regional em andamento';
  }

  return 'Status: Regional finalizado';
}

export function getChampionshipDateCopy(championship: Championship) {
  const start = formatOfficialDate(championship.schedule.start);
  const end = formatOfficialDate(championship.schedule.end);

  if (championship.scope === 'national') {
    if (championship.dateStatus === 'to_be_defined') return 'A definir';
    return start ? `Início em ${start}` : '';
  }

  if (start && end) return `${start} - ${end}`;
  if (start) return `Início em ${start}`;
  return '';
}
