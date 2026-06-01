'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react';
import { limit, orderBy, useAuth, useCollection, where } from '@batalha/firebase';
import { Badge, Button, Skeleton } from '@batalha/ui';
import { BRAZIL_STATE_LABELS, type DailyHighlight } from '@batalha/types';
import { LikeDailyHighlightModal } from '@/components/daily-highlights/like-daily-highlight-modal';
import { SubmitDailyHighlightButton } from '@/components/daily-highlights/submit-daily-highlight-button';
import { SubmitDailyHighlightModal } from '@/components/daily-highlights/submit-daily-highlight-modal';
import { MediaPreview } from '@/components/media/media-preview';
import {
  DAILY_HIGHLIGHTS_MIN_DAY_KEY,
  formatBrazilDayKey,
  getBrazilDayKey,
  getDailyHighlightsForDay,
  getDailyHighlightPodiumMeta,
  shiftBrazilDayKey,
} from '@/lib/daily-highlight-view';
import {
  getDailyHighlightLikeForVisibleDay,
  getDailyHighlightVoteState,
  type DailyHighlightLikeView,
} from '@/lib/daily-highlight-vote-view';

export default function DailyHighlightsPage() {
  const { user } = useAuth();
  const [selectedHighlight, setSelectedHighlight] = useState<DailyHighlight | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const todayKey = useMemo(() => getBrazilDayKey(), []);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const isTodaySelected = selectedDayKey === todayKey;
  const dailyHighlightQuery = useMemo(
    () =>
      isTodaySelected
        ? [where('dayKey', '==', selectedDayKey), orderBy('createdAt', 'desc'), limit(500)]
        : [
            where('dayKey', '==', selectedDayKey),
            where('status', '==', 'finalized'),
            where('placement', '>=', 1),
            orderBy('placement', 'asc'),
            limit(3),
          ],
    [isTodaySelected, selectedDayKey],
  );
  const { data: dailyHighlights, loading } = useCollection<DailyHighlight>(
    'dailyHighlights',
    dailyHighlightQuery,
  );
  const { data: dailyHighlightLikes } = useCollection<DailyHighlightLikeView>(
    user ? 'dailyHighlightLikes' : undefined,
    user ? [where('userId', '==', user.uid), limit(30)] : [],
  );
  const { data: todayUserHighlights } = useCollection<DailyHighlight>(
    user ? 'dailyHighlights' : undefined,
    user ? [where('dayKey', '==', todayKey), where('userId', '==', user.uid), limit(1)] : [],
  );
  const hasSubmittedToday = todayUserHighlights.length > 0;

  const visibleHighlights = useMemo(() => {
    return getDailyHighlightsForDay({
      highlights: dailyHighlights,
      dayKey: selectedDayKey,
      todayKey,
    });
  }, [dailyHighlights, selectedDayKey, todayKey]);
  const visibleDayKey = visibleHighlights[0]?.dayKey ?? null;
  const canGoToPreviousDay = selectedDayKey > DAILY_HIGHLIGHTS_MIN_DAY_KEY;
  const canGoToNextDay = selectedDayKey < todayKey;
  const currentDailyVote = useMemo(
    () =>
      getDailyHighlightLikeForVisibleDay({
        likes: dailyHighlightLikes,
        visibleDayKey: isTodaySelected ? visibleDayKey : null,
      }),
    [dailyHighlightLikes, isTodaySelected, visibleDayKey],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Destaques Diários - {formatBrazilDayKey(selectedDayKey)}
            </h1>
            <p className="mt-1 text-sm text-surface-500">
              {isTodaySelected
                ? 'Vote em um destaque por dia ou envie o seu para ganhar 1 ponto.'
                : 'Top 3 finalizados do dia selecionado.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canGoToPreviousDay}
              onClick={() => {
                if (canGoToPreviousDay) {
                  const previousDayKey = shiftBrazilDayKey(selectedDayKey, -1);
                  setSelectedDayKey(
                    previousDayKey < DAILY_HIGHLIGHTS_MIN_DAY_KEY
                      ? DAILY_HIGHLIGHTS_MIN_DAY_KEY
                      : previousDayKey,
                  );
                }
              }}
              aria-label="Ver dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-32 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-semibold text-white">
              {formatBrazilDayKey(selectedDayKey)}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canGoToNextDay}
              onClick={() => {
                if (canGoToNextDay) {
                  const nextDayKey = shiftBrazilDayKey(selectedDayKey, 1);
                  setSelectedDayKey(nextDayKey > todayKey ? todayKey : nextDayKey);
                }
              }}
              aria-label="Ver proximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            {!isTodaySelected && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDayKey(todayKey)}>
                Ir para Hoje
              </Button>
            )}
            {isTodaySelected && (
              <SubmitDailyHighlightButton
                isAuthenticated={Boolean(user)}
                hasSubmittedToday={hasSubmittedToday}
                onClick={() => setSubmitOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {isTodaySelected && currentDailyVote && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-400" />
          <p>
            Seu voto de hoje foi registrado. A entrada escolhida aparece marcada como{' '}
            <span className="font-semibold text-white">Seu voto</span>.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36" />)
        ) : visibleHighlights.length > 0 ? (
          visibleHighlights.map((highlight, index) => {
            const voteState = getDailyHighlightVoteState({
              highlightId: highlight.id,
              like: currentDailyVote,
            });

            if (!isTodaySelected) {
              const podium = getDailyHighlightPodiumMeta(highlight.placement ?? index + 1);
              const naturalidade = highlight.userBirthState
                ? BRAZIL_STATE_LABELS[highlight.userBirthState]
                : null;
              const toneClass =
                podium?.tone === 'gold'
                  ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200'
                  : podium?.tone === 'silver'
                    ? 'border-surface-300/25 bg-surface-300/10 text-surface-100'
                    : 'border-amber-700/30 bg-amber-700/10 text-amber-200';

              return (
                <div
                  key={highlight.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-surface-900/70 p-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_8rem] sm:items-center"
                >
                  <div
                    className={`flex h-20 flex-col items-center justify-center rounded-2xl border ${toneClass}`}
                  >
                    <Trophy className="h-5 w-5" />
                    <span className="mt-1 text-lg font-black tabular-nums">
                      {podium?.shortLabel ?? `#${index + 1}`}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-white">
                      {highlight.userDisplayName}
                    </p>
                    <p className="mt-1 text-sm text-surface-400">
                      {naturalidade ? `${naturalidade} · ` : ''}
                      {highlight.voteCount} {highlight.voteCount === 1 ? 'voto' : 'votos'}
                    </p>
                  </div>

                  <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    <Badge variant="default" className="justify-center py-2 sm:w-28">
                      {podium?.label ?? `Top ${index + 1}`}
                    </Badge>
                    {(highlight.placementPointsAwarded ?? 0) > 0 && (
                      <span className="inline-flex items-center justify-center rounded-lg border border-brand-400/20 bg-brand-500/10 px-3 py-2 text-xs font-bold text-brand-200 sm:w-28">
                        +{highlight.placementPointsAwarded ?? 0} pts
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={highlight.id}
                className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2.5 rounded-2xl border p-3 sm:grid-cols-[5rem_minmax(0,1fr)_7rem] sm:items-center sm:gap-3 ${
                  voteState.isSelectedVote
                    ? 'border-brand-500/40 bg-brand-500/10'
                    : 'border-white/10 bg-surface-900/70'
                }`}
              >
                <div className="flex h-28 items-center justify-center rounded-xl border border-white/10 bg-surface-950/60 px-2 text-center sm:h-32">
                  <span className="w-full text-center text-sm font-bold tabular-nums text-surface-300 sm:text-base">
                    #{index + 1}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="h-28 min-w-0 sm:h-32">
                    <MediaPreview
                      mediaType={highlight.mediaType}
                      mediaURL={highlight.mediaURL}
                      videoURL={highlight.videoURL}
                      username={highlight.userDisplayName}
                      naturalidade={
                        highlight.userBirthState
                          ? BRAZIL_STATE_LABELS[highlight.userBirthState]
                          : null
                      }
                      category={highlight.category}
                      durationSeconds={highlight.mediaDurationSeconds}
                      voteCount={highlight.voteCount}
                      size="compact"
                    />
                  </div>
                </div>

                <div className="col-span-2 flex justify-end sm:col-span-1 sm:justify-center">
                  {!isTodaySelected ? (
                    <Badge variant="default" className="w-full justify-center py-2 sm:w-24">
                      Top {index + 1}
                    </Badge>
                  ) : voteState.isSelectedVote ? (
                    <Badge variant="success" className="w-full justify-center py-2 sm:w-24">
                      Seu voto
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedHighlight(highlight)}
                      disabled={!voteState.canVote}
                      className="h-10 w-full sm:w-24"
                    >
                      {voteState.buttonLabel}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-card text-center">
            <p className="text-sm text-surface-500">
              {isTodaySelected
                ? 'Ainda não há destaques hoje. Envie o primeiro e ganhe 1 ponto.'
                : 'Não há vencedores finalizados para este dia.'}
            </p>
          </div>
        )}
      </div>

      <LikeDailyHighlightModal
        dailyHighlight={selectedHighlight}
        onClose={() => setSelectedHighlight(null)}
      />
      <SubmitDailyHighlightModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}
