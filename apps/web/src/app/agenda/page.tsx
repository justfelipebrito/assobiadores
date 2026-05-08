'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from 'lucide-react';
import { orderBy, useCollection } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatDateTime, formatRelativeTime } from '@batalha/utils';
import type { Battle, Championship, QualifierTrack } from '@batalha/types';
import { getUpcomingEventItems } from '@/lib/header-ticker';

const KIND_LABEL = {
  battle: 'Batalha',
  qualifier: 'Classificatória',
  championship: 'Campeonato',
} as const;

export default function AgendaPage() {
  const { data: battles, loading: battlesLoading } = useCollection<Battle>('battles', [
    orderBy('createdAt', 'desc'),
  ]);
  const { data: qualifierTracks, loading: qualifierTracksLoading } =
    useCollection<QualifierTrack>('qualifierTracks', [orderBy('registrationDeadline', 'asc')]);
  const { data: championships, loading: championshipsLoading } = useCollection<Championship>(
    'championships',
    [orderBy('createdAt', 'desc')],
  );

  const events = useMemo(
    () => getUpcomingEventItems({ battles, qualifierTracks, championships }),
    [battles, championships, qualifierTracks],
  );
  const loading = battlesLoading || qualifierTracksLoading || championshipsLoading;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Início
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="mt-1 text-surface-400">
            Próximos eventos entre batalhas, classificatórias e campeonatos.
          </p>
        </div>
        <p className="text-sm text-surface-500">{events.length} eventos futuros</p>
      </div>

      <div className="mt-8 space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : events.length > 0 ? (
          events.map((event) => (
            <Link key={event.id} href={event.href}>
              <Card className="group cursor-pointer">
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={event.badgeVariant}>{event.badgeLabel}</Badge>
                        <Badge variant="default">{KIND_LABEL[event.kind]}</Badge>
                        <span className="text-xs font-semibold text-brand-400">
                          {event.statusLabel}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-white transition-colors group-hover:text-brand-400">
                        {event.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-surface-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {formatDateTime(event.nextAt)}
                        </span>
                        <span>{formatRelativeTime(event.nextAt)}</span>
                      </div>
                    </div>

                    <span
                      className="inline-flex h-9 w-fit items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-surface-200 transition-colors hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300"
                    >
                      {event.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            title="Nenhum evento futuro"
            description="Quando houver batalhas, classificatórias ou campeonatos com próximas datas, eles aparecerão aqui."
          />
        )}
      </div>
    </div>
  );
}
