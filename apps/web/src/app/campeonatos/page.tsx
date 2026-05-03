'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronDown, Trophy } from 'lucide-react';
import { limit, orderBy, useCollection } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatRelativeTime, toDate } from '@batalha/utils';
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type BrazilState,
  type Championship,
  type CompetitionCategory,
} from '@batalha/types';
import { sortChampionshipsForDisplay } from '@/lib/championship-view';

const BRAZIL_STATES: { value: BrazilState; label: string }[] = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

type ScopeFilter = 'all' | 'national' | 'regional';
type CategoryFilter = 'all' | CompetitionCategory;
type RegionFilter = 'all' | BrazilState;

function SelectChevron() {
  return (
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
  );
}

export default function ChampionshipsPage() {
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const { data: championships, loading } = useCollection<Championship>('championships', [
    orderBy('createdAt', 'desc'),
    limit(120),
  ]);

  const filteredChampionships = useMemo(() => {
    return sortChampionshipsForDisplay(championships).filter((championship) => {
      if (scopeFilter !== 'all' && championship.scope !== scopeFilter) return false;
      if (categoryFilter !== 'all' && championship.category !== categoryFilter) return false;
      if (
        scopeFilter === 'regional' &&
        regionFilter !== 'all' &&
        championship.region !== regionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, championships, regionFilter, scopeFilter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Início
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Campeonatos</h1>
          <p className="mt-1 text-surface-400">
            Temporada 2026 com competições nacionais e regionais por categoria
          </p>
        </div>
        <p className="text-sm text-surface-500">{filteredChampionships.length} campeonatos</p>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-surface-500">Liga</p>
          <div className="relative">
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-10 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
            >
              <option value="all">Todas</option>
              <option value="national">Nacional</option>
              <option value="regional">Regional</option>
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-surface-500">Categoria</p>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
              className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-10 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
            >
              <option value="all">Todas</option>
              {COMPETITION_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-surface-500">Estado</p>
          <div className="relative">
            <select
              value={scopeFilter === 'regional' ? regionFilter : 'all'}
              onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
              disabled={scopeFilter !== 'regional'}
              className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-10 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">Todos os estados</option>
              {BRAZIL_STATES.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-44" />)
        ) : filteredChampionships.length > 0 ? (
          filteredChampionships.map((championship) => {
            const start = toDate(championship.schedule.start);
            return (
              <Link key={championship.id} href={`/campeonatos/${championship.id}`}>
                <Card className="group h-full cursor-pointer">
                  <CardContent className="flex h-full flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={championship.scope === 'national' ? 'gold' : 'purple'}>
                          {championship.scope === 'national' ? 'Nacional' : championship.region}
                        </Badge>
                        <Badge variant="default">
                          {COMPETITION_CATEGORY_LABELS[championship.category]}
                        </Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 text-surface-600 transition-colors group-hover:text-brand-400" />
                    </div>
                    <h2 className="mt-3 font-semibold text-white transition-colors group-hover:text-brand-400">
                      {championship.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm text-surface-500">
                      {championship.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-surface-400">
                      <span>
                        {championship.currentParticipants}/{championship.maxParticipants}{' '}
                        competidores
                      </span>
                      {start && <span>{formatRelativeTime(start)}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          <div className="sm:col-span-2">
            <EmptyState
              icon={<Trophy className="h-12 w-12" />}
              title="Nenhum campeonato encontrado"
              description="Ajuste os filtros para ver outros campeonatos da temporada."
            />
          </div>
        )}
      </div>
    </div>
  );
}
