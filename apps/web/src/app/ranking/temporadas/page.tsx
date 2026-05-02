'use client';

import Link from 'next/link';
import { Trophy, Calendar, Globe, MapPin, ArrowRight, Clock } from 'lucide-react';
import { useCollection, orderBy, where } from '@batalha/firebase';
import { Badge, Card, CardContent, Skeleton, EmptyState } from '@batalha/ui';
import { formatDate } from '@batalha/utils';
import type { Season } from '@batalha/types';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return null;
}

const STATUS_CONFIG = {
  upcoming: { label: 'Em breve', variant: 'default' as const },
  active:   { label: 'Ativa',    variant: 'success' as const },
  archived: { label: 'Encerrada', variant: 'default' as const },
};

export default function SeasonsPage() {
  const { data: activeSeason, loading: activeLoading } = useCollection<Season>(
    'seasons',
    [where('status', '==', 'active'), orderBy('start', 'desc')],
  );

  const { data: archivedSeasons, loading: archivedLoading } = useCollection<Season>(
    'seasons',
    [where('status', '==', 'archived'), orderBy('end', 'desc')],
  );

  const { data: upcomingSeasons, loading: upcomingLoading } = useCollection<Season>(
    'seasons',
    [where('status', '==', 'upcoming'), orderBy('start', 'asc')],
  );

  const loading = activeLoading || archivedLoading || upcomingLoading;

  const allSeasons = [
    ...upcomingSeasons,
    ...activeSeason,
    ...archivedSeasons,
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/ranking" className="text-sm text-surface-400 hover:text-white transition-colors">
          Ranking
        </Link>
        <span className="text-surface-600">/</span>
        <span className="text-sm text-white">Temporadas</span>
      </div>

      <div className="text-center mt-4">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Temporadas</h1>
        <p className="mt-1 text-surface-400">Historico de todas as temporadas competitivas</p>
      </div>

      <div className="mt-10 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : allSeasons.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Nenhuma temporada ainda"
            description="As temporadas competitivas aparecao aqui quando forem criadas."
          />
        ) : (
          allSeasons.map((season) => {
            const cfg = STATUS_CONFIG[season.status] ?? STATUS_CONFIG.archived;
            const start = toDate(season.start);
            const end = toDate(season.end);
            const isActive = season.status === 'active';

            return (
              <Card key={season.id} className={isActive ? 'ring-1 ring-brand-500/30' : ''}>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <Badge variant="default" className="gap-1">
                          {season.scope === 'national' ? (
                            <><Globe className="h-3 w-3" /> Nacional</>
                          ) : (
                            <><MapPin className="h-3 w-3" /> {season.region}</>
                          )}
                        </Badge>
                      </div>
                      <h3 className="mt-2 font-semibold text-white">{season.name}</h3>
                      {(start || end) && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-surface-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {start && formatDate(start)}
                          {start && end && ' — '}
                          {end && formatDate(end)}
                        </div>
                      )}
                      {season.championshipIds.length > 0 && (
                        <p className="mt-1 text-xs text-surface-600">
                          {season.championshipIds.length} campeonato{season.championshipIds.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <Link href="/ranking">
                        <div className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                          Ver ranking
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
