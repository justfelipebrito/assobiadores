'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame, Heart } from 'lucide-react';
import { limit, orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Button, Card, CardContent, Skeleton } from '@batalha/ui';
import { formatNumber, toDate } from '@batalha/utils';
import type { DailyHighlight } from '@batalha/types';
import { LikeDailyHighlightModal } from '@/components/daily-highlights/like-daily-highlight-modal';
import { SubmitDailyHighlightButton } from '@/components/daily-highlights/submit-daily-highlight-button';
import { SubmitDailyHighlightModal } from '@/components/daily-highlights/submit-daily-highlight-modal';

export default function DailyHighlightsPage() {
  const { user } = useAuth();
  const [selectedHighlight, setSelectedHighlight] = useState<DailyHighlight | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { data: dailyHighlights, loading } = useCollection<DailyHighlight>('dailyHighlights', [
    orderBy('createdAt', 'desc'),
    limit(100),
  ]);

  const visibleHighlights = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return dailyHighlights
      .filter((highlight) => {
        const createdAt = toDate(highlight.createdAt);
        return highlight.status === 'active' && createdAt && createdAt >= todayStart;
      })
      .sort((a, b) => {
        const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
        if (voteDiff !== 0) return voteDiff;

        const aCreatedAt = toDate(a.createdAt)?.getTime() ?? 0;
        const bCreatedAt = toDate(b.createdAt)?.getTime() ?? 0;
        return bCreatedAt - aCreatedAt;
      });
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
              Curta seus favoritos ou envie o seu para ganhar 10 pontos.
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
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20" />)
        ) : visibleHighlights.length > 0 ? (
          visibleHighlights.map((highlight, index) => (
            <Card key={highlight.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-sm font-bold text-surface-500">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{highlight.userDisplayName}</p>
                  <p className="text-sm text-surface-500">
                    {formatNumber(highlight.voteCount)} curtidas
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedHighlight(highlight)}
                  className="flex-shrink-0"
                >
                  <Heart className="mr-1 h-4 w-4" />
                  Curtir
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="glass-card text-center">
            <p className="text-sm text-surface-500">
              Ainda nao ha destaques hoje. Envie o primeiro e ganhe 10 pontos.
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
