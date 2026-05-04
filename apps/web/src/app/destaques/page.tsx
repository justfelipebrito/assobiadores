'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame } from 'lucide-react';
import { limit, orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Button, Skeleton } from '@batalha/ui';
import { BRAZIL_STATE_LABELS, type DailyHighlight } from '@batalha/types';
import { LikeDailyHighlightModal } from '@/components/daily-highlights/like-daily-highlight-modal';
import { SubmitDailyHighlightButton } from '@/components/daily-highlights/submit-daily-highlight-button';
import { SubmitDailyHighlightModal } from '@/components/daily-highlights/submit-daily-highlight-modal';
import { MediaPreview } from '@/components/media/media-preview';
import { getVisibleDailyHighlights } from '@/lib/daily-highlight-view';

export default function DailyHighlightsPage() {
  const { user } = useAuth();
  const [selectedHighlight, setSelectedHighlight] = useState<DailyHighlight | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { data: dailyHighlights, loading } = useCollection<DailyHighlight>('dailyHighlights', [
    orderBy('createdAt', 'desc'),
    limit(100),
  ]);

  const visibleHighlights = useMemo(() => {
    return getVisibleDailyHighlights({ highlights: dailyHighlights });
  }, [dailyHighlights]);

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
            <h1 className="text-2xl font-bold text-white">Destaques Diários</h1>
            <p className="mt-1 text-sm text-surface-500">
              Vote em um destaque por dia ou envie o seu para ganhar 1 ponto.
            </p>
          </div>
        </div>
        <SubmitDailyHighlightButton
          isAuthenticated={Boolean(user)}
          onClick={() => setSubmitOpen(true)}
        />
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-36" />)
        ) : visibleHighlights.length > 0 ? (
          visibleHighlights.map((highlight, index) => (
            <div
              key={highlight.id}
              className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-surface-900/70 p-3 sm:grid-cols-[5rem_minmax(0,1fr)_7rem] sm:items-center"
            >
              <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-white/10 bg-surface-950/60 px-2 text-center">
                <span className="w-full text-center text-sm font-bold tabular-nums text-surface-300 sm:text-base">
                  #{index + 1}
                </span>
              </div>

              <div className="min-w-0">
                <div className="h-32">
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedHighlight(highlight)}
                  className="w-full sm:w-24"
                >
                  Votar
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card text-center">
            <p className="text-sm text-surface-500">
              Ainda nao ha destaques hoje. Envie o primeiro e ganhe 1 ponto.
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
