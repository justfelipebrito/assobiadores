'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart2,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Rocket,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { limit, orderBy, useAuth, useCollection, useDocument, where } from '@batalha/firebase';
import { Avatar, Badge, Button, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber, formatRelativeTime, toDate } from '@batalha/utils';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORY_LABELS,
  type Battle,
  type Championship,
  type DailyHighlight,
  type HomepageSettings,
  type QualifierTrack,
  type Season,
  type SeasonRanking,
  type User,
} from '@batalha/types';
import {
  getUserRankingPoints,
  getUserRankingRegion,
  type RankingEntry,
} from '@/lib/ranking-view';
import { SubmitDailyHighlightButton } from '@/components/daily-highlights/submit-daily-highlight-button';
import { SubmitDailyHighlightModal } from '@/components/daily-highlights/submit-daily-highlight-modal';
import {
  formatBrazilDayKey,
  getBrazilDayKey,
  getDailyHighlightPlacementLabel,
  getDailyHighlightPromoText,
  getVisibleDailyHighlights,
} from '@/lib/daily-highlight-view';
import {
  getChampionshipDateCopy,
  getChampionshipParticipantCount,
  getChampionshipStatusCopy,
  getVisibleHomepageChampionships,
} from '@/lib/championship-view';
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
  registration: { label: 'Inscrições', variant: 'success' },
  active: { label: 'Ao Vivo', variant: 'success' },
  voting: { label: 'Votação', variant: 'purple' },
  finished: { label: 'Finalizada', variant: 'default' },
};

const BATTLE_THUMBNAIL_BG: Record<string, string> = {
  active: 'bg-[#0e1710]',
  voting: 'bg-[#111018]',
  registration: 'bg-[#13131a]',
  finished: 'bg-[#0f0f14]',
};

const PODIUM_RING = ['ring-yellow-400/70', 'ring-surface-300/50', 'ring-amber-600/50'] as const;
const PODIUM_BG = [
  'bg-yellow-500/[0.07]',
  'bg-surface-300/[0.03]',
  'bg-amber-700/[0.05]',
] as const;
const PODIUM_NUMBER_BG = [
  'bg-yellow-400 text-black',
  'bg-surface-300 text-black',
  'bg-amber-700 text-white',
] as const;

type PlatformStats = { users: number; battles: number };

function buildWave(seed: string): number[] {
  return Array.from({ length: 40 }, (_, i) => {
    const char = seed.charCodeAt(i % Math.max(seed.length, 1)) || 7;
    return 15 + ((char + i * 13) % 70);
  });
}

function HighlightFeaturedCard({
  highlight,
  username,
  naturalidade,
  resultLabel,
}: {
  highlight: DailyHighlight;
  username: string;
  naturalidade: string | null;
  resultLabel: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(highlight.mediaDurationSeconds ?? 0);
  const wave = useMemo(
    () => buildWave(`${highlight.mediaURL ?? ''}-${username}`),
    [highlight.mediaURL, username],
  );
  const progress = duration > 0 ? currentTime / duration : 0;

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !highlight.mediaURL) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  return (
    <div className="relative flex min-h-[244px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]">
      {/* Decorative icon — rotated, artistic, not a background wash */}
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 -rotate-12 opacity-[0.09]">
        <Music2 className="h-40 w-40 text-white" />
      </div>
      {/* Dark fade at bottom for text legibility */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#13131a] to-transparent" />

      <div className="relative z-10 flex items-center gap-1.5 p-3 pb-0">
        <span className="rounded border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-surface-300">
          {COMPETITION_CATEGORY_LABELS[highlight.category]}
        </span>
        {resultLabel && (
          <span className="flex items-center gap-1 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black">
            <Crown className="h-2.5 w-2.5" />
            {resultLabel}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-auto p-3">
        <h3 className="truncate text-sm font-black leading-tight text-white sm:text-base">
          {username}
          {naturalidade && <span className="text-brand-400"> - {naturalidade}</span>}
        </h3>
        <p className="mt-0.5 text-[11px] font-semibold text-brand-400">
          {highlight.voteCount} {highlight.voteCount === 1 ? 'voto' : 'votos'}
        </p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="flex flex-1 items-end gap-[2px] overflow-hidden" style={{ height: 24 }}>
            {wave.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-150 ${i / wave.length <= progress ? 'bg-brand-400' : 'bg-white/[0.14]'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          {highlight.mediaURL && (
            <button
              onClick={toggle}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_16px_rgba(37,169,114,0.35)] transition-transform hover:scale-105 hover:bg-brand-400 active:scale-95"
              aria-label={playing ? 'Pausar' : 'Tocar'}
            >
              {playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="ml-0.5 h-4 w-4 text-white" />}
            </button>
          )}
        </div>
      </div>

      {highlight.mediaURL && (
        <audio
          ref={audioRef}
          src={highlight.mediaURL}
          preload="metadata"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        />
      )}
    </div>
  );
}

function HighlightCompactCard({
  highlight,
  username,
  naturalidade,
  resultLabel,
}: {
  highlight: DailyHighlight;
  username: string;
  naturalidade: string | null;
  resultLabel: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(highlight.mediaDurationSeconds ?? 0);
  const wave = useMemo(
    () => buildWave(`${highlight.mediaURL ?? ''}-${username}`).slice(0, 24),
    [highlight.mediaURL, username],
  );
  const progress = duration > 0 ? currentTime / duration : 0;

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !highlight.mediaURL) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  return (
    <div className="flex min-h-[114px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#13131a]">
      {/* Left: thumbnail — 40% width, darker surface, music icon */}
      <div className="relative w-[40%] flex-shrink-0 bg-[#0c0c13]">
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0c0c13] to-transparent" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.10]">
          <Music2 className="h-14 w-14 -rotate-12 text-white" />
        </div>
        <div className="absolute bottom-2 left-2 z-10">
          <span className="rounded border border-white/[0.10] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-surface-300">
            {COMPETITION_CATEGORY_LABELS[highlight.category]}
          </span>
        </div>
      </div>

      {/* Right: info + player */}
      <div className="flex flex-1 flex-col justify-between p-2.5">
        <div>
          {resultLabel && (
            <span className="mb-1 flex w-fit items-center gap-1 rounded bg-yellow-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
              <Crown className="h-2 w-2" />
              {resultLabel}
            </span>
          )}
          <h3 className="truncate text-[13px] font-black leading-tight text-white">
            {username}
            {naturalidade && <span className="text-brand-400"> - {naturalidade}</span>}
          </h3>
          <p className="mt-0.5 text-[10px] font-semibold text-brand-400">
            {highlight.voteCount} {highlight.voteCount === 1 ? 'voto' : 'votos'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-end gap-[2px] overflow-hidden" style={{ height: 18 }}>
            {wave.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-150 ${i / wave.length <= progress ? 'bg-brand-400' : 'bg-white/[0.14]'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          {highlight.mediaURL && (
            <button
              onClick={toggle}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_12px_rgba(37,169,114,0.3)] transition-transform hover:scale-105 hover:bg-brand-400 active:scale-95"
              aria-label={playing ? 'Pausar' : 'Tocar'}
            >
              {playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="ml-0.5 h-4 w-4 text-white" />}
            </button>
          )}
        </div>
      </div>

      {highlight.mediaURL && (
        <audio
          ref={audioRef}
          src={highlight.mediaURL}
          preload="metadata"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        />
      )}
    </div>
  );
}

function HighlightPlaceholderCard() {
  return (
    <div className="flex min-h-[114px] overflow-hidden rounded-2xl border border-white/[0.04] bg-[#0f0f15]">
      <div className="relative w-[40%] flex-shrink-0 bg-[#0a0a11]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
          <Music2 className="h-14 w-14 -rotate-12 text-white" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        <p className="text-center text-[11px] text-surface-700">Próximo destaque em breve</p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
  hrefLabel = 'Ver todos',
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5">
          <Icon className="h-[18px] w-[18px] text-brand-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white sm:text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-surface-500 sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-medium text-surface-400 transition-colors hover:text-white"
        >
          {hrefLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const [submitDailyOpen, setSubmitDailyOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const todayDailyHighlightKey = useMemo(() => getBrazilDayKey(), []);
  const dailyHighlightDayLabel = useMemo(
    () => formatBrazilDayKey(todayDailyHighlightKey),
    [todayDailyHighlightKey],
  );
  const { data: homepageSettings } = useDocument<HomepageSettings>('platformSettings', 'homepage');
  const dailyHighlightPromoText = useMemo(
    () => getDailyHighlightPromoText(homepageSettings, todayDailyHighlightKey),
    [homepageSettings, todayDailyHighlightKey],
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

  const activeBattles = useMemo(
    () =>
      battles
        .filter((battle) => ['registration', 'active', 'voting'].includes(battle.status))
        .slice(0, 8),
    [battles],
  );
  const visibleChampionships = useMemo(
    () => getVisibleHomepageChampionships(championships, 20),
    [championships],
  );
  const dailyHighlights = useMemo(
    () => getVisibleDailyHighlights({ highlights: highlightedSubmissions, limit: 3 }),
    [highlightedSubmissions],
  );
  const featuredHighlight = dailyHighlights[0];
  const secondaryHighlights = dailyHighlights.slice(1, 3);
  const highlightUsersById = useMemo(
    () => new Map(highlightUsers.map((u) => [u.id, u])),
    [highlightUsers],
  );
  const hasSubmittedDailyHighlightToday = todayUserHighlights.length > 0;

  const qualifierStates = useMemo(
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
        const diff = getUserRankingPoints(b, rankingSeasonId) - getUserRankingPoints(a, rankingSeasonId);
        return diff !== 0 ? diff : a.displayName.localeCompare(b.displayName);
      }),
    [rankingUsers, rankingSeasonId, seasonRankingUsers],
  );
  const topRankingUsers = useMemo(() => sortedRankingUsers.slice(0, 20), [sortedRankingUsers]);

  const heroItem = useMemo(
    () =>
      activeBattles.find((b) => b.status === 'active') ??
      activeBattles.find((b) => b.status === 'voting') ??
      activeBattles[0] ??
      null,
    [activeBattles],
  );

  const getHighlightNaturalidade = (highlight: DailyHighlight) => {
    const userProfile = highlightUsersById.get(highlight.userId);
    const state = highlight.userBirthState ?? userProfile?.birthState ?? userProfile?.state ?? null;
    return state ? BRAZIL_STATE_LABELS[state] : null;
  };
  const getHomepageHighlightResultLabel = (highlight: DailyHighlight) => {
    if (highlight.dayKey !== todayDailyHighlightKey || highlight.status !== 'finalized') return null;
    return getDailyHighlightPlacementLabel(highlight);
  };

  useEffect(() => {
    let active = true;
    fetch('/api/platform/stats')
      .then(async (res) => (res.ok ? ((await res.json()) as PlatformStats) : null))
      .then((stats) => { if (active && stats) setPlatformStats(stats); })
      .catch(() => { if (active) setPlatformStats(null); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {/* ── HERO BANNER ───────────────────────────────────────── */}
      {heroItem && (
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0e0e14]">

          <div className="relative px-6 py-16 sm:py-20 lg:py-24">
            <div className="max-w-2xl">
              {/* Live / status indicator */}
              <div className="mb-4 flex items-center gap-2.5">
                {heroItem.status === 'active' && (
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
                  </span>
                )}
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-400">
                  {heroItem.status === 'active'
                    ? 'Ao Vivo Agora'
                    : heroItem.status === 'voting'
                      ? 'Em Votação'
                      : 'Inscrições Abertas'}
                </span>
              </div>

              {/* Two-line title like the reference */}
              <p className="text-sm font-medium text-surface-400 sm:text-base">Batalha de Assobio</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
                {heroItem.title}
              </h1>

              {/* Meta */}
              <p className="mt-4 text-sm text-surface-400">
                {heroItem.currentParticipants} participantes
                {heroItem.entryFee === 0
                  ? ' · Entrada gratuita'
                  : ` · ${formatCurrency(heroItem.entryFee)}`}
                {heroItem.prizePool > 0 && ` · Prêmio ${formatCurrency(heroItem.prizePool)}`}
              </p>

              {/* CTA — styled like the "PLAY NOW" button in the reference */}
              <div className="mt-8">
                <Link href={`/batalhas/${heroItem.id}`}>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-6 py-3 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all hover:border-brand-500/50 hover:bg-brand-500/15 hover:text-brand-300">
                    Ver detalhes
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Destaques Diários ─────────────────────────────────── */}
      <section className="border-b border-white/5 px-4 py-8 sm:px-6">
        {dailyHighlightPromoText && (
          <div className="mb-5 rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-50">
            {dailyHighlightPromoText}
          </div>
        )}

        <div className="mb-5 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5">
              <Flame className="h-[18px] w-[18px] text-brand-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white sm:text-lg">Destaques Diários</h2>
              <p className="text-xs text-surface-400">{dailyHighlightDayLabel}</p>
              <p className="text-xs text-surface-500">Votos da comunidade, envie o seu e concorra ao top 3 diário</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubmitDailyHighlightButton
              isAuthenticated={Boolean(user)}
              hasSubmittedToday={hasSubmittedDailyHighlightToday}
              onClick={() => setSubmitDailyOpen(true)}
            />
            <Link
              href="/destaques"
              className="flex items-center gap-1 text-sm font-medium text-surface-400 transition-colors hover:text-white"
            >
              Ver mais
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {highlightsLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="min-h-[244px] rounded-2xl" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-[114px] rounded-2xl" />
              <Skeleton className="h-[114px] rounded-2xl" />
            </div>
          </div>
        ) : featuredHighlight ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <HighlightFeaturedCard
              highlight={featuredHighlight}
              username={
                featuredHighlight.userDisplayName ||
                highlightUsersById.get(featuredHighlight.userId)?.displayName ||
                'Assobiador'
              }
              naturalidade={getHighlightNaturalidade(featuredHighlight)}
              resultLabel={getHomepageHighlightResultLabel(featuredHighlight)}
            />

            <div className="flex flex-col gap-4">
              {secondaryHighlights.map((highlight) => (
                <HighlightCompactCard
                  key={highlight.id}
                  highlight={highlight}
                  username={
                    highlight.userDisplayName ||
                    highlightUsersById.get(highlight.userId)?.displayName ||
                    'Assobiador'
                  }
                  naturalidade={getHighlightNaturalidade(highlight)}
                  resultLabel={getHomepageHighlightResultLabel(highlight)}
                    />
              ))}
              {Array.from({ length: Math.max(0, 2 - secondaryHighlights.length) }).map((_, i) => (
                <HighlightPlaceholderCard key={i} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Flame className="h-6 w-6 text-surface-600" />
            </div>
            <p className="text-sm text-surface-500">
              Os destaques aparecem quando houver assobios aprovados e votados.
            </p>
          </div>
        )}
      </section>

      {/* ── Batalhas ──────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-4 py-8 sm:px-6">
        <SectionHeader
          icon={Swords}
          title="Batalhas"
          subtitle="Acontecendo agora"
          href="/batalhas"
          hrefLabel="Ver todas"
        />

        {battlesLoading ? (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[280px] flex-shrink-0">
                <Skeleton className="h-[162px] w-full rounded-xl" />
                <div className="mt-2 space-y-2 px-0.5">
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : activeBattles.length > 0 ? (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {activeBattles.map((battle) => {
              const status = STATUS_MAP[battle.status] ?? STATUS_MAP.finished!;
              const isPaid = battle.entryFee > 0;
              const regEnd = toDate(battle.registrationEnd);
              const thumbnailBg = BATTLE_THUMBNAIL_BG[battle.status] ?? BATTLE_THUMBNAIL_BG.finished!;
              const isActive = battle.status === 'active';

              return (
                <Link
                  key={battle.id}
                  href={`/batalhas/${battle.id}`}
                  className="group w-[280px] flex-shrink-0 sm:w-[300px]"
                >
                  <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#13131a] transition-all duration-200 group-hover:border-white/[0.12] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">

                    {/* Thumbnail area */}
                    <div className={`relative overflow-hidden ${thumbnailBg}`} style={{ aspectRatio: '16/9' }}>
                      {/* Soft blur glows — depth without color gradients */}
                      <div className="pointer-events-none absolute -left-6 -top-6 h-28 w-28 rounded-full bg-white/[0.05] blur-2xl" />
                      <div className="pointer-events-none absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/[0.04] blur-2xl" />
                      {/* Status badge — pill shape like "Live" in the ref */}
                      <div className="absolute right-2.5 top-2.5 z-10">
                        {isActive ? (
                          <div className="flex items-center gap-1.5 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg shadow-brand-900/50">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            Ao Vivo
                          </div>
                        ) : (
                          <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                        )}
                      </div>

                      {/* Official badge — top left */}
                      {battle.type === 'official' && (
                        <div className="absolute left-2.5 top-2.5 z-10">
                          <Badge variant="gold" className="text-[10px]">
                            <Trophy className="mr-1 h-2.5 w-2.5" />
                            Oficial
                          </Badge>
                        </div>
                      )}

                      {/* Center play-style icon — turns brand on hover */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm ring-2 ring-white/20 transition-all duration-200 group-hover:scale-110 group-hover:bg-brand-500 group-hover:ring-brand-400/50">
                          <Swords className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-sm font-bold text-white transition-colors group-hover:text-brand-300">
                          {battle.title}
                        </h3>
                        <MoreHorizontal className="h-4 w-4 flex-shrink-0 text-surface-600" />
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-surface-600">
                        Batalha de Assobio
                      </p>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 font-semibold text-brand-400">
                          <Users className="h-3 w-3" />
                          {battle.currentParticipants} participantes
                        </span>
                        {battle.prizePool > 0 && (
                          <span className="font-semibold text-yellow-400">
                            {formatCurrency(battle.prizePool)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-surface-400">
                          {isPaid ? formatCurrency(battle.entryFee) : 'Gratuita'}
                        </span>
                        {regEnd && (
                          <span className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-surface-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(regEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Swords className="h-6 w-6 text-surface-600" />
            </div>
            <p className="font-medium text-surface-300">Nenhuma batalha ativa no momento</p>
            <p className="mt-1 text-sm text-surface-500">Novas batalhas serão criadas em breve.</p>
          </div>
        )}
      </section>

      {/* ── Classificatórias ──────────────────────────────────── */}
      <section className="border-b border-white/5 px-4 py-8 sm:px-6">
        <SectionHeader
          icon={Rocket}
          title="Classificatórias"
          subtitle={
            user && profile?.birthState
              ? `Abertas para ${BRAZIL_STATE_LABELS[profile.birthState]}`
              : 'Abertas em São Paulo e Rio de Janeiro'
          }
          href="/classificatorias"
          hrefLabel="Ver todas"
        />

        {qualifierTracksLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : visibleQualifierTracks.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQualifierTracks.slice(0, 6).map((track) => (
              <Link key={track.id} href={`/classificatorias/${track.slug}`}>
                <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-900 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-yellow-500/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold" className="text-[11px]">{getQualifierTrackStatusCopy(track)}</Badge>
                    <Badge variant="default" className="text-[11px]">{BRAZIL_STATE_LABELS[track.region]}</Badge>
                  </div>
                  <h3 className="mt-4 flex-1 text-base font-bold text-white transition-colors group-hover:text-brand-300">
                    {COMPETITION_CATEGORY_LABELS[track.category]}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-surface-500">
                    Entrada aberta. Até 64 melhores avançam ao Regional.
                  </p>
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <p className="text-xs text-surface-600">Até {QUALIFIER_REGISTRATION_DEADLINE_LABEL}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-400 transition-colors group-hover:bg-brand-500/20">
                      Inscrever-se
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14">
            <p className="text-surface-500">Nenhuma classificatória disponível no momento.</p>
          </div>
        )}
      </section>

      {/* ── Rankings ──────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-4 py-8 sm:px-6">
        <SectionHeader
          icon={BarChart2}
          title="Rankings"
          subtitle={rankingSeasonLabel}
          href="/ranking"
          hrefLabel="Ver completo"
        />

        {(rankingSeasonId ? seasonRankingUsersLoading : rankingUsersLoading) ? (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[196px] w-[148px] flex-shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : topRankingUsers.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {topRankingUsers.map((rankUser, index) => {
              const points = getUserRankingPoints(rankUser, rankingSeasonId);
              const region = getUserRankingRegion(rankUser);
              const userId = 'userId' in rankUser ? rankUser.userId : rankUser.id;
              const photoURL = 'photoURL' in rankUser ? rankUser.photoURL : null;
              const isPodium = index < 3;

              return (
                <Link
                  key={rankUser.id}
                  href={`/perfil/${userId}`}
                  className="group w-[160px] flex-shrink-0"
                >
                  <div
                    className={`flex h-full flex-col items-center rounded-2xl border border-white/[0.07] px-3 pb-4 pt-3 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${isPodium ? PODIUM_BG[index] : 'bg-surface-900'}`}
                  >
                    <div className="mb-2 flex w-full items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
                        TOP
                      </span>
                      <span className="text-[10px] font-bold text-surface-500">#{index + 1}</span>
                    </div>
                    <div className={`relative rounded-full ${isPodium ? `p-0.5 ring-2 ring-offset-2 ring-offset-surface-950 ${PODIUM_RING[index]}` : 'p-0'}`}>
                      <Avatar src={photoURL} name={rankUser.displayName} size="xl" />
                      {isPodium && (
                        <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-lg ${PODIUM_NUMBER_BG[index]}`}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 w-full truncate text-sm font-bold text-white transition-colors group-hover:text-brand-300">
                      {rankUser.displayName.split(' ')[0]}
                    </p>
                    {region && (
                      <p className="mt-0.5 text-[11px] text-brand-500">{region}</p>
                    )}
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="text-sm font-bold tabular-nums text-white">{formatNumber(points)}</span>
                      <span className="text-[10px] text-surface-600">pts</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14">
            <p className="text-surface-500">O ranking aparecerá após as primeiras batalhas.</p>
          </div>
        )}
      </section>

      {/* ── Campeonatos ───────────────────────────────────────── */}
      <section className="border-b border-white/5 px-4 py-8 sm:px-6">
        <SectionHeader
          icon={Trophy}
          title="Campeonatos"
          subtitle="Temporada anual oficial"
          href="/campeonatos"
          hrefLabel="Ver todos"
        />

        {championshipsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : visibleChampionships.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleChampionships.slice(0, 6).map((championship) => {
              const dateCopy = getChampionshipDateCopy(championship);
              const participantCount = getChampionshipParticipantCount(championship);
              return (
                <Link key={championship.id} href={`/campeonatos/${championship.id}`}>
                  <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-900 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={championship.scope === 'national' ? 'gold' : 'purple'} className="text-[11px]">
                        {championship.scope === 'national' ? 'Nacional' : championship.region}
                      </Badge>
                      <Badge variant="default" className="text-[11px]">
                        {COMPETITION_CATEGORY_LABELS[championship.category]}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs font-medium text-surface-500">{getChampionshipStatusCopy(championship)}</p>
                    <h3 className="mt-2 flex-1 font-bold text-white transition-colors group-hover:text-brand-300">
                      {championship.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-surface-500">
                      {championship.description || 'Participe das classificatórias para disputar vagas oficiais.'}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-3 text-xs text-surface-400">
                      {participantCount > 0 && (
                        <span>
                          <span className="tabular-nums font-semibold text-white">{participantCount}</span>
                          /{championship.maxParticipants} competidores
                        </span>
                      )}
                      {dateCopy && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {dateCopy}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14 text-center px-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Trophy className="h-6 w-6 text-surface-600" />
            </div>
            <p className="font-medium text-white">Temporada oficial em preparação</p>
            <p className="mt-1 text-sm text-surface-500">Campeonatos nacionais e regionais em breve.</p>
          </div>
        )}
      </section>

      {/* ── Plataforma + CTA ──────────────────────────────────── */}
      <section className="px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                <Users className="h-[18px] w-[18px] text-surface-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">
                  {platformStats ? formatNumber(platformStats.users) : '—'}
                </p>
                <p className="text-xs text-surface-500">Assobiadores</p>
              </div>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                <Swords className="h-[18px] w-[18px] text-surface-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">
                  {platformStats ? formatNumber(platformStats.battles) : '—'}
                </p>
                <p className="text-xs text-surface-500">Batalhas</p>
              </div>
            </div>
          </div>

          {/* CTA for guests */}
          {!authLoading && !user && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-surface-400 sm:text-right">
                Crie sua conta e comece a competir
              </p>
              <Link
                href="/cadastro"
                onClick={() => trackAuthCtaClick({ action: 'signup', location: 'home_join_card' })}
              >
                <Button size="md" className="w-full sm:w-auto">
                  Criar conta grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      <SubmitDailyHighlightModal open={submitDailyOpen} onClose={() => setSubmitDailyOpen(false)} />
    </>
  );
}
