'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  ChevronDown,
  Clock,
  Crown,
  Flame,
  Globe,
  MapPin,
  Medal,
  Music,
  Rocket,
  Sparkles,
  Swords,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react';
import { limit, orderBy, useAuth, useCollection, useDocument, where } from '@batalha/firebase';
import { Avatar, Badge, Button, Card, CardContent, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber, formatRelativeTime, toDate } from '@batalha/utils';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type Battle,
  type BrazilState,
  type Championship,
  type CompetitionCategory,
  type DailyHighlight,
  type QualifierTrack,
  type Season,
  type SeasonRanking,
  type User,
} from '@batalha/types';
import {
  getUserRankingPoints,
  getUserRankingRank,
  getUserRankingRegion,
  type RankingEntry,
} from '@/lib/ranking-view';
import { SubmitDailyHighlightButton } from '@/components/daily-highlights/submit-daily-highlight-button';
import { SubmitDailyHighlightModal } from '@/components/daily-highlights/submit-daily-highlight-modal';
import {
  formatBrazilDayKey,
  getBrazilDayKey,
  getDailyHighlightPlacementLabel,
  getVisibleDailyHighlights,
} from '@/lib/daily-highlight-view';
import {
  getChampionshipDateCopy,
  getChampionshipParticipantCount,
  getChampionshipStatusCopy,
  getVisibleHomepageChampionships,
} from '@/lib/championship-view';
import { MediaPreview } from '@/components/media/media-preview';
import {
  DEFAULT_PUBLIC_QUALIFIER_STATES,
  getQualifierTrackStatusCopy,
  getQualifierTracksForStates,
  QUALIFIER_REGISTRATION_DEADLINE_LABEL,
} from '@/lib/qualifier-tracks';
import { trackAuthCtaClick } from '@/lib/analytics-events';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }
> = {
  registration: { label: 'Inscricoes abertas', variant: 'success' },
  active: { label: 'Em andamento', variant: 'info' },
  voting: { label: 'Em votacao', variant: 'purple' },
  finished: { label: 'Finalizada', variant: 'default' },
};

const PLACE_ICONS = [
  <Crown key="1" className="h-4 w-4 text-yellow-400" />,
  <Medal key="2" className="h-4 w-4 text-surface-300" />,
  <Award key="3" className="h-4 w-4 text-amber-600" />,
];

const BRAZIL_STATES = Object.entries(BRAZIL_STATE_LABELS).map(([value, label]) => ({
  value: value as BrazilState,
  label,
}));

type PlatformStats = {
  users: number;
  battles: number;
};

function RankingList({
  users,
  loading,
  emptyLabel,
  seasonId,
}: {
  users: RankingEntry[];
  loading: boolean;
  emptyLabel: string;
  seasonId: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-white/5 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-3 py-3">
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-surface-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {users.map((user, index) => {
        const points = getUserRankingPoints(user, seasonId);
        const rank = getUserRankingRank(user, seasonId);
        const region = getUserRankingRegion(user);

        return (
          <Link
            key={user.id}
            href={`/perfil/${'userId' in user ? user.userId : user.id}`}
            className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
              {index < 3 ? (
                PLACE_ICONS[index]
              ) : (
                <span className="text-sm font-bold text-surface-600">{index + 1}</span>
              )}
            </div>
            <Avatar src={'photoURL' in user ? user.photoURL : null} name={user.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-surface-500">
                {rank}
                {region ? ` - ${region}` : ''}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-white">{formatNumber(points)}</p>
              <p className="text-[10px] text-surface-600">pts</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [selectedRegionalState, setSelectedRegionalState] = useState<BrazilState>('SP');
  const [submitDailyOpen, setSubmitDailyOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const todayDailyHighlightKey = useMemo(() => getBrazilDayKey(), []);
  const dailyHighlightDayLabel = useMemo(
    () => formatBrazilDayKey(todayDailyHighlightKey),
    [todayDailyHighlightKey],
  );
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useDocument<User>('users', user?.uid);
  const { data: activeSeasons } = useCollection<Season>('seasons', [
    orderBy('start', 'desc'),
    limit(3),
  ]);
  const activeSeason = activeSeasons.find((season) => season.status === 'active') ?? null;
  const rankingSeasonId = activeSeason?.id ?? null;
  const rankingSeasonLabel = activeSeason?.name ?? `Temporada ${new Date().getFullYear()}`;

  const { data: battles, loading: battlesLoading } = useCollection<Battle>('battles', [
    orderBy('createdAt', 'desc'),
    limit(12),
  ]);
  const { data: championships, loading: championshipsLoading } = useCollection<Championship>(
    'championships',
    [orderBy('createdAt', 'desc'), limit(100)],
  );

  const { data: rankingUsers, loading: rankingUsersLoading } = useCollection<User>('users', [
    orderBy('points', 'desc'),
    limit(500),
  ]);
  const seasonRankingCollection = rankingSeasonId
    ? `seasonRankings/${rankingSeasonId}/users`
    : undefined;
  const { data: seasonRankingUsers, loading: seasonRankingUsersLoading } =
    useCollection<SeasonRanking>(
      seasonRankingCollection,
      seasonRankingCollection ? [orderBy('totalPoints', 'desc'), limit(500)] : [],
    );
  const { data: highlightUsers } = useCollection<User>('users', [limit(100)]);

  const { data: highlightedSubmissions, loading: highlightsLoading } =
    useCollection<DailyHighlight>('dailyHighlights', [orderBy('createdAt', 'desc'), limit(100)]);
  const { data: todayUserHighlights } = useCollection<DailyHighlight>(
    user ? 'dailyHighlights' : undefined,
    user
      ? [where('dayKey', '==', todayDailyHighlightKey), where('userId', '==', user.uid), limit(1)]
      : [],
  );
  const { data: qualifierTracks, loading: qualifierTracksLoading } = useCollection<QualifierTrack>(
    'qualifierTracks',
    [limit(200)],
  );

  const { data: recentlyUpdatedBattles, loading: winnersLoading } = useCollection<Battle>(
    'battles',
    [orderBy('updatedAt', 'desc'), limit(8)],
  );

  const activeBattles = useMemo(
    () =>
      battles
        .filter((battle) => ['registration', 'active', 'voting'].includes(battle.status))
        .slice(0, 6),
    [battles],
  );
  const visibleChampionships = useMemo(
    () => getVisibleHomepageChampionships(championships, 20),
    [championships],
  );
  const recentWinners = useMemo(
    () => recentlyUpdatedBattles.filter((battle) => battle.status === 'finished').slice(0, 3),
    [recentlyUpdatedBattles],
  );
  const dailyHighlights = useMemo(() => {
    return getVisibleDailyHighlights({ highlights: highlightedSubmissions, limit: 3 });
  }, [highlightedSubmissions]);
  const featuredHighlight = dailyHighlights[0];
  const secondaryHighlights = dailyHighlights.slice(1, 3);
  const highlightUsersById = useMemo(
    () => new Map(highlightUsers.map((highlightUser) => [highlightUser.id, highlightUser])),
    [highlightUsers],
  );
  const highlightsMoreHref = '/destaques';
  const hasSubmittedDailyHighlightToday = todayUserHighlights.length > 0;
  const getHomepageHighlightResultLabel = (highlight: DailyHighlight) => {
    if (highlight.dayKey !== todayDailyHighlightKey || highlight.status !== 'finalized') return null;
    return getDailyHighlightPlacementLabel(highlight);
  };

  const hasActiveBattles = activeBattles.length > 0;
  const qualifierStates = useMemo<BrazilState[]>(
    () => (user && profile?.birthState ? [profile.birthState] : DEFAULT_PUBLIC_QUALIFIER_STATES),
    [profile?.birthState, user],
  );
  const visibleQualifierTracks = useMemo(
    () => getQualifierTracksForStates({ tracks: qualifierTracks, states: qualifierStates }),
    [qualifierStates, qualifierTracks],
  );
  const sortedRankingUsers = useMemo(
    () =>
      [...(rankingSeasonId ? seasonRankingUsers : rankingUsers)].sort((a, b) => {
        const aPoints = getUserRankingPoints(a, rankingSeasonId);
        const bPoints = getUserRankingPoints(b, rankingSeasonId);
        const diff = bPoints - aPoints;
        if (diff !== 0) return diff;
        return a.displayName.localeCompare(b.displayName);
      }),
    [rankingUsers, rankingSeasonId, seasonRankingUsers],
  );
  const nationalUsers = useMemo(() => sortedRankingUsers.slice(0, 20), [sortedRankingUsers]);
  const regionalUsers = useMemo(
    () =>
      sortedRankingUsers
        .filter((regionalUser) => getUserRankingRegion(regionalUser) === selectedRegionalState)
        .slice(0, 20),
    [selectedRegionalState, sortedRankingUsers],
  );
  const selectedRegionalStateLabel =
    BRAZIL_STATES.find((state) => state.value === selectedRegionalState)?.label ?? 'Sao Paulo';
  const getHighlightNaturalidade = (highlight: DailyHighlight) => {
    const userProfile = highlightUsersById.get(highlight.userId);
    const state = highlight.userBirthState ?? userProfile?.birthState ?? userProfile?.state ?? null;
    return state ? BRAZIL_STATE_LABELS[state] : null;
  };

  useEffect(() => {
    let active = true;

    fetch('/api/platform/stats')
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PlatformStats;
      })
      .then((stats) => {
        if (active && stats) {
          setPlatformStats(stats);
        }
      })
      .catch(() => {
        if (active) {
          setPlatformStats(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="border-b border-white/5 bg-surface-950">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Destaques Diários - {dailyHighlightDayLabel}
                </h1>
                <p className="text-sm text-surface-500">
                  Escolhidos e premiados pelos votos da comunidade, envie o seu e concorra!
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <SubmitDailyHighlightButton
                isAuthenticated={Boolean(user)}
                hasSubmittedToday={hasSubmittedDailyHighlightToday}
                onClick={() => setSubmitDailyOpen(true)}
              />
              <Link href={highlightsMoreHref}>
                <Button variant="ghost" size="sm">
                  Ver mais
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {highlightsLoading ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
              <Skeleton className="aspect-video" />
              <div className="grid gap-4">
                <Skeleton className="aspect-video" />
                <Skeleton className="aspect-video" />
              </div>
            </div>
          ) : featuredHighlight ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:items-stretch">
              <MediaPreview
                mediaType={featuredHighlight.mediaType}
                mediaURL={featuredHighlight.mediaURL}
                videoURL={featuredHighlight.videoURL}
                username={
                  featuredHighlight.userDisplayName ||
                  highlightUsersById.get(featuredHighlight.userId)?.displayName ||
                  'Assobiador'
                }
                naturalidade={getHighlightNaturalidade(featuredHighlight)}
                category={featuredHighlight.category}
                durationSeconds={featuredHighlight.mediaDurationSeconds}
                voteCount={featuredHighlight.voteCount}
                resultLabel={getHomepageHighlightResultLabel(featuredHighlight)}
              />

              <div className="grid gap-4 lg:grid-rows-2">
                {secondaryHighlights.map((highlight) => (
                  <MediaPreview
                    key={highlight.id}
                    mediaType={highlight.mediaType}
                    mediaURL={highlight.mediaURL}
                    videoURL={highlight.videoURL}
                    username={
                      highlight.userDisplayName ||
                      highlightUsersById.get(highlight.userId)?.displayName ||
                      'Assobiador'
                    }
                    naturalidade={getHighlightNaturalidade(highlight)}
                    category={highlight.category}
                    durationSeconds={highlight.mediaDurationSeconds}
                    voteCount={highlight.voteCount}
                    size="compact"
                    resultLabel={getHomepageHighlightResultLabel(highlight)}
                  />
                ))}
                {secondaryHighlights.length < 2 &&
                  Array.from({ length: 2 - secondaryHighlights.length }).map((_, index) => (
                    <div
                      key={`empty-highlight-${index}`}
                      className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center"
                    >
                      <p className="text-sm text-surface-500">
                        Mais assobios aparecem conforme a comunidade vota.
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="glass-card text-center">
              <Music className="mx-auto h-10 w-10 text-surface-600" />
              <p className="text-sm text-surface-500">
                Os destaques diarios aparecem quando houver assobios aprovados e votados.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section className="order-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Classificatórias</h2>
                  <p className="text-sm text-surface-500">
                    {user && profile?.birthState
                      ? `Categorias abertas para ${BRAZIL_STATE_LABELS[profile.birthState]}`
                      : 'Abertas em São Paulo e Rio de Janeiro'}
                  </p>
                </div>
              </div>
              <Link href="/classificatorias">
                <Button variant="ghost" size="sm">
                  Ver todas
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {qualifierTracksLoading
                ? Array.from({ length: user ? 3 : 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-44" />
                  ))
                : visibleQualifierTracks.slice(0, 6).map((track) => (
                    <Link key={track.id} href={`/classificatorias/${track.slug}`}>
                      <Card className="group h-full cursor-pointer">
                        <CardContent className="flex h-full flex-col">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="gold">{getQualifierTrackStatusCopy(track)}</Badge>
                            <Badge variant="default">{BRAZIL_STATE_LABELS[track.region]}</Badge>
                          </div>
                          <h3 className="mt-4 font-semibold text-white transition-colors group-hover:text-brand-400">
                            {COMPETITION_CATEGORY_LABELS[track.category]}
                          </h3>
                          <p className="mt-2 flex-1 text-sm text-surface-500">
                            Entrada aberta para todos. Até 64 melhores avançam ao Regional da
                            categoria.
                          </p>
                          <p className="mt-4 text-xs text-surface-500">
                            Inscrições até {QUALIFIER_REGISTRATION_DEADLINE_LABEL}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
            </div>
          </section>

          <section className="order-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Campeonatos</h2>
                  <p className="text-sm text-surface-500">Temporada anual oficial</p>
                </div>
              </div>
              <Link href="/campeonatos">
                <Button variant="ghost" size="sm">
                  Ver todos
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {championshipsLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)
              ) : visibleChampionships.length > 0 ? (
                visibleChampionships.map((championship, index) => {
                  const dateCopy = getChampionshipDateCopy(championship);
                  const participantCount = getChampionshipParticipantCount(championship);
                  return (
                    <Link
                      key={championship.id}
                      href={`/campeonatos/${championship.id}`}
                      className={index >= 6 ? 'hidden sm:block' : undefined}
                    >
                      <Card className="group h-full cursor-pointer">
                        <CardContent className="flex h-full flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant={championship.scope === 'national' ? 'gold' : 'purple'}
                              >
                                {championship.scope === 'national'
                                  ? 'Nacional'
                                  : championship.region}
                              </Badge>
                              <Badge variant="default">
                                {COMPETITION_CATEGORY_LABELS[championship.category]}
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 min-h-4 text-xs font-medium text-surface-500">
                            {getChampionshipStatusCopy(championship)}
                          </p>
                          <h3 className="mt-3 min-h-12 font-semibold text-white transition-colors group-hover:text-brand-400">
                            {championship.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 min-h-10 flex-1 text-sm text-surface-500">
                            {championship.description ||
                              'Participe das classificatorias para disputar vagas oficiais.'}
                          </p>
                          <div className="mt-4 flex items-end justify-between gap-3 text-sm">
                            {participantCount > 0 && (
                              <span className="min-w-0 text-surface-400">
                                <span className="tabular-nums">
                                  {participantCount}/{championship.maxParticipants}
                                </span>{' '}
                                competidores
                              </span>
                            )}
                            {dateCopy && (
                              <span
                                className={
                                  participantCount > 0
                                    ? 'flex min-w-0 items-center justify-end gap-1 text-right text-surface-500'
                                    : 'flex min-w-0 items-center gap-1 text-left text-surface-500'
                                }
                              >
                                <Clock className="h-3.5 w-3.5" />
                                {dateCopy}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              ) : (
                <div className="glass-card sm:col-span-2">
                  <p className="font-medium text-white">Temporada oficial em preparacao</p>
                  <p className="mt-1 text-sm text-surface-500">
                    Campeonatos nacionais e regionais terao classificatorias. Participacao oficial
                    exigira assinatura valida.
                  </p>
                  <Link href="/campeonatos" className="mt-4 inline-block">
                    <Button variant="secondary" size="sm">
                      Ver todos
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="order-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                  <Swords className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Batalhas</h2>
                  <p className="text-sm text-surface-500">Acontecendo agora</p>
                </div>
              </div>
              <Link href="/batalhas">
                <Button variant="ghost" size="sm">
                  Ver todas
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {battlesLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)
              ) : hasActiveBattles ? (
                activeBattles.map((battle) => {
                  const status = STATUS_MAP[battle.status] || STATUS_MAP.finished!;
                  const isPaid = battle.entryFee > 0;
                  const regEnd = toDate(battle.registrationEnd);

                  return (
                    <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                      <Card className="group h-full cursor-pointer">
                        <CardContent className="flex h-full flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {battle.type === 'official' && (
                              <Badge variant="gold" className="text-[10px]">
                                <Trophy className="mr-1 h-3 w-3" />
                                Oficial
                              </Badge>
                            )}
                          </div>

                          <h3 className="mt-3 flex-1 font-semibold text-white transition-colors group-hover:text-brand-400">
                            {battle.title}
                          </h3>

                          <div className="mt-4 space-y-2 text-sm text-surface-400">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                {battle.currentParticipants} participantes
                              </span>
                              {regEnd && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatRelativeTime(regEnd)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              {isPaid ? (
                                <span className="font-semibold text-brand-400">
                                  {formatCurrency(battle.entryFee)}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-brand-400">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Gratuita
                                </span>
                              )}
                              {battle.prizePool > 0 && (
                                <span className="text-yellow-400">
                                  Premio: {formatCurrency(battle.prizePool)}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              ) : (
                <div className="sm:col-span-2">
                  <div className="glass-card text-center">
                    <Music className="mx-auto h-10 w-10 text-surface-600" />
                    <p className="mt-3 font-medium text-surface-300">
                      Nenhuma batalha ativa no momento
                    </p>
                    <p className="mt-1 text-sm text-surface-500">
                      Novas batalhas serao criadas em breve.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 self-start space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Rankings</h2>
                <p className="text-sm text-surface-500">{rankingSeasonLabel}</p>
              </div>
            </div>
            <Link href="/ranking">
              <Button variant="ghost" size="sm">
                Ver
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-brand-400" />
                  <h3 className="font-semibold text-white">Ranking Nacional</h3>
                </div>
                <p className="mt-1 text-xs text-surface-500">
                  Top 20 do Brasil na temporada
                </p>
              </div>
              <RankingList
                users={nationalUsers}
                loading={rankingSeasonId ? seasonRankingUsersLoading : rankingUsersLoading}
                emptyLabel="O ranking nacional aparecera apos as primeiras batalhas."
                seasonId={rankingSeasonId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-400" />
                  <h3 className="font-semibold text-white">Ranking Regional</h3>
                </div>
                <p className="mt-1 text-xs text-surface-500">
                  Top 20 de {selectedRegionalStateLabel} na temporada
                </p>
                <div className="relative mt-3">
                  <select
                    value={selectedRegionalState}
                    onChange={(event) =>
                      setSelectedRegionalState(event.target.value as BrazilState)
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-9 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
                  >
                    {BRAZIL_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                </div>
              </div>
              <RankingList
                users={regionalUsers}
                loading={rankingSeasonId ? seasonRankingUsersLoading : rankingUsersLoading}
                emptyLabel={`O ranking regional de ${selectedRegionalStateLabel} ainda nao tem participantes.`}
                seasonId={rankingSeasonId}
              />
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Plataforma</h2>
                <p className="text-sm text-surface-500">Numeros gerais</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Assobiadores',
                  value: platformStats ? formatNumber(platformStats.users) : '...',
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: 'Batalhas',
                  value: platformStats ? formatNumber(platformStats.battles) : '...',
                  icon: <Swords className="h-4 w-4" />,
                },
              ].map((stat) => (
                <div key={stat.label} className="glass-card text-center">
                  <div className="mx-auto mb-2 inline-flex rounded-lg bg-white/5 p-2 text-surface-400">
                    {stat.icon}
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-surface-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Ultimos vencedores</h2>
                <p className="text-sm text-surface-500">Resultados recentes</p>
              </div>
            </div>

            {winnersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : recentWinners.length > 0 ? (
              <div className="space-y-3">
                {recentWinners.map((battle) => (
                  <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                    <Card className="group cursor-pointer">
                      <CardContent className="py-3">
                        <p className="text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
                          {battle.title}
                        </p>
                        {battle.winners.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-yellow-400" />
                            <span className="text-xs text-surface-400">
                              {battle.winners[0]?.userId}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-card text-center">
                <p className="text-sm text-surface-500">Nenhuma batalha finalizada ainda.</p>
              </div>
            )}
          </section>
        </aside>

        {!authLoading && !user && (
          <section className="text-center lg:col-span-2">
            <div className="glass-card mx-auto max-w-xl">
              <h3 className="text-lg font-bold text-white">Quer participar?</h3>
              <p className="mt-1 text-sm text-surface-400">
                Crie sua conta gratis e participe de batalhas, campeonatos e muito mais.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/cadastro"
                  onClick={() => trackAuthCtaClick({ action: 'signup', location: 'home_join_card' })}
                >
                  <Button size="md" className="w-full sm:w-auto">
                    Criar conta gratis
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
      <SubmitDailyHighlightModal open={submitDailyOpen} onClose={() => setSubmitDailyOpen(false)} />
    </>
  );
}
