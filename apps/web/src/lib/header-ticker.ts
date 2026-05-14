import type { Battle, Championship, QualifierTrack } from '@batalha/types';
import { BRAZIL_STATE_LABELS, COMPETITION_CATEGORY_LABELS, type BrazilState } from '@batalha/types';
import { toDate } from '@batalha/utils';

type TickerVariant = 'default' | 'success' | 'warning' | 'info' | 'purple' | 'gold';

export type HeaderTickerItem = {
  id: string;
  kind: 'battle' | 'qualifier' | 'championship';
  href: string;
  actionHref: string;
  actionLabel: string;
  badgeLabel: string;
  badgeVariant: TickerVariant;
  statusLabel: string;
  title: string;
  nextAt: Date;
  participantCount: number;
  region: BrazilState | null;
};

const ACTIVE_BATTLE_STATUSES = ['registration', 'active', 'voting'] as const;
const ACTIVE_QUALIFIER_STATUSES = ['registration_open', 'draw_pending', 'active'] as const;
const ACTIVE_CHAMPIONSHIP_STATUSES = ['upcoming', 'registration', 'active'] as const;

function isFutureOrCurrent(date: Date, now: Date) {
  return date.getTime() >= now.getTime();
}

function battleTickerItem(battle: Battle, now: Date): HeaderTickerItem | null {
  if (!ACTIVE_BATTLE_STATUSES.includes(battle.status as (typeof ACTIVE_BATTLE_STATUSES)[number])) {
    return null;
  }

  const nextAt =
    battle.status === 'voting'
      ? toDate(battle.votingEnd)
      : battle.status === 'active'
        ? toDate(battle.submissionDeadline)
        : toDate(battle.submissionDeadline);

  if (!nextAt || !isFutureOrCurrent(nextAt, now)) return null;

  const statusLabel =
    battle.status === 'voting' ? 'Votação' : battle.status === 'active' ? 'Envios' : 'Envios';
  const action =
    battle.status === 'voting'
      ? { href: `/batalhas/${battle.id}`, label: 'Votar' }
      : battle.status === 'active'
        ? { href: `/batalhas/${battle.id}`, label: 'Enviar' }
        : { href: `/batalhas/${battle.id}`, label: 'Participar' };

  return {
    id: `battle:${battle.id}`,
    kind: 'battle',
    href: `/batalhas/${battle.id}`,
    actionHref: action.href,
    actionLabel: action.label,
    badgeLabel: battle.type === 'official' ? 'Oficial' : 'Batalha',
    badgeVariant: battle.type === 'official' ? 'gold' : 'default',
    statusLabel,
    title: battle.title,
    nextAt,
    participantCount: battle.currentParticipants ?? 0,
    region: null,
  };
}

function qualifierTickerItem(track: QualifierTrack, now: Date): HeaderTickerItem | null {
  if (
    !ACTIVE_QUALIFIER_STATUSES.includes(
      track.status as (typeof ACTIVE_QUALIFIER_STATUSES)[number],
    )
  ) {
    return null;
  }

  const nextAt =
    track.status === 'registration_open'
      ? toDate(track.registrationDeadline)
      : track.status === 'draw_pending'
        ? toDate(track.bracketStart)
        : toDate(track.bracketEnd);

  if (!nextAt || !isFutureOrCurrent(nextAt, now)) return null;

  const statusLabel =
    track.status === 'registration_open'
      ? 'Inscrições'
      : track.status === 'draw_pending'
        ? 'Sorteio'
        : 'Confrontos';

  return {
    id: `qualifier:${track.id}`,
    kind: 'qualifier',
    href: `/classificatorias/${track.slug}`,
    actionHref: `/classificatorias/${track.slug}`,
    actionLabel: track.status === 'registration_open' ? 'Entrar' : 'Ver',
    badgeLabel: 'Classificatória',
    badgeVariant: 'warning',
    statusLabel,
    title: `${BRAZIL_STATE_LABELS[track.region]} ${COMPETITION_CATEGORY_LABELS[track.category]}`,
    nextAt,
    participantCount: track.confirmedCount + track.pendingPaymentCount || track.registeredCount,
    region: track.region,
  };
}

function championshipTickerItem(championship: Championship, now: Date): HeaderTickerItem | null {
  if (
    !ACTIVE_CHAMPIONSHIP_STATUSES.includes(
      championship.status as (typeof ACTIVE_CHAMPIONSHIP_STATUSES)[number],
    )
  ) {
    return null;
  }

  if (championship.dateStatus === 'to_be_defined') return null;

  const nextAt =
    championship.status === 'active'
      ? toDate(championship.schedule.end)
      : toDate(championship.schedule.start);

  if (!nextAt || !isFutureOrCurrent(nextAt, now)) return null;

  return {
    id: `championship:${championship.id}`,
    kind: 'championship',
    href: `/campeonatos/${championship.id}`,
    actionHref: `/campeonatos/${championship.id}`,
    actionLabel: 'Ver',
    badgeLabel: championship.scope === 'national' ? 'Nacional' : 'Campeonato',
    badgeVariant: 'gold',
    statusLabel: championship.status === 'active' ? 'Em andamento' : 'Início',
    title: championship.title,
    nextAt,
    participantCount: championship.currentParticipants ?? championship.participantIds.length,
    region: championship.region,
  };
}

export function getUpcomingEventItems({
  battles,
  qualifierTracks,
  championships,
  now = new Date(),
  preferredRegion = null,
}: {
  battles: Battle[];
  qualifierTracks: QualifierTrack[];
  championships: Championship[];
  now?: Date;
  preferredRegion?: BrazilState | null;
}) {
  return [
    ...battles.map((battle) => battleTickerItem(battle, now)),
    ...qualifierTracks.map((track) => qualifierTickerItem(track, now)),
    ...championships.map((championship) => championshipTickerItem(championship, now)),
  ]
    .filter((item): item is HeaderTickerItem => Boolean(item))
    .sort((a, b) => {
      if (preferredRegion) {
        const aPreferredQualifier = a.kind === 'qualifier' && a.region === preferredRegion;
        const bPreferredQualifier = b.kind === 'qualifier' && b.region === preferredRegion;
        if (aPreferredQualifier !== bPreferredQualifier) return aPreferredQualifier ? -1 : 1;
      }

      const diff = a.nextAt.getTime() - b.nextAt.getTime();
      if (diff !== 0) return diff;
      const participantDiff = b.participantCount - a.participantCount;
      if (participantDiff !== 0) return participantDiff;
      return a.title.localeCompare(b.title);
    });
}

export function getHeaderTickerItems({
  battles,
  qualifierTracks,
  championships,
  now = new Date(),
  limit = 8,
  preferredRegion = null,
}: {
  battles: Battle[];
  qualifierTracks: QualifierTrack[];
  championships: Championship[];
  now?: Date;
  limit?: number;
  preferredRegion?: BrazilState | null;
}) {
  return getUpcomingEventItems({
    battles,
    qualifierTracks,
    championships,
    now,
    preferredRegion,
  }).slice(0, limit);
}
