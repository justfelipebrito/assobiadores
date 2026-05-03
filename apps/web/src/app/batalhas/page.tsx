'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Swords, Users, Clock, ArrowRight, Trophy, Sparkles, Filter } from 'lucide-react';
import { useCollection, orderBy } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, Skeleton, EmptyState } from '@batalha/ui';
import { formatCurrency, formatRelativeTime, toDate } from '@batalha/utils';
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type Battle,
  type BattleStatus,
  type BattleCategory,
} from '@batalha/types';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }
> = {
  registration: { label: 'Inscricoes abertas', variant: 'success' },
  active: { label: 'Em andamento', variant: 'info' },
  voting: { label: 'Em votacao', variant: 'purple' },
  finished: { label: 'Finalizada', variant: 'default' },
};

const CATEGORY_MAP: Record<string, string> = COMPETITION_CATEGORY_LABELS;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'registration', label: 'Inscricoes abertas' },
  { value: 'active', label: 'Em andamento' },
  { value: 'voting', label: 'Em votacao' },
  { value: 'finished', label: 'Finalizadas' },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  ...COMPETITION_CATEGORIES,
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'official', label: 'Oficiais' },
  { value: 'community', label: 'Comunidade' },
];

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
          : 'bg-white/5 text-surface-400 hover:bg-white/10 hover:text-surface-300'
      }`}
    >
      {label}
    </button>
  );
}

export default function BattlesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const {
    data: battles,
    loading,
    error,
  } = useCollection<Battle>('battles', [orderBy('createdAt', 'desc')]);

  const filtered = useMemo(() => {
    return battles.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && b.type !== typeFilter) return false;
      return true;
    });
  }, [battles, statusFilter, categoryFilter, typeFilter]);

  const activeFilterCount = [statusFilter, categoryFilter, typeFilter].filter(
    (f) => f !== 'all',
  ).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Batalhas</h1>
        <p className="mt-1 text-surface-400">
          Encontre batalhas para participar e mostrar seu talento
        </p>
      </div>

      {/* Filters */}
      <div className="mt-6 space-y-4">
        {/* Status */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-500">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={statusFilter === opt.value}
                onClick={() => setStatusFilter(opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Category + Type row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-500">
              Categoria
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={categoryFilter === opt.value}
                  onClick={() => setCategoryFilter(opt.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-500">
              Tipo
            </p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={typeFilter === opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Active filter count + clear */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-500">
              {filtered.length} batalha{filtered.length !== 1 ? 's' : ''} encontrada
              {filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setTypeFilter('all');
              }}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Battle list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)
        ) : error ? (
          <EmptyState
            icon={<Filter className="h-12 w-12" />}
            title="Nao foi possivel carregar as batalhas"
            description={error}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-12 w-12" />}
            title={
              activeFilterCount > 0
                ? 'Nenhuma batalha com esses filtros'
                : 'Nenhuma batalha disponivel'
            }
            description={
              activeFilterCount > 0
                ? 'Tente ajustar os filtros para ver mais batalhas.'
                : 'Novas batalhas serao criadas em breve. Fique ligado!'
            }
            action={
              activeFilterCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((battle) => {
            const status = STATUS_MAP[battle.status] || STATUS_MAP.finished!;
            const isPaid = battle.entryFee > 0;
            const registrationEnd = toDate(battle.registrationEnd);

            return (
              <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                <Card className="group cursor-pointer">
                  <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <Badge variant="default">
                            {CATEGORY_MAP[battle.category] || battle.category}
                          </Badge>
                          {battle.type === 'official' && (
                            <Badge variant="gold">
                              <Trophy className="mr-1 h-3 w-3" />
                              Oficial
                            </Badge>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                          {battle.title}
                        </h3>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-surface-400">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {battle.currentParticipants}
                            {battle.maxParticipants > 0 && `/${battle.maxParticipants}`}{' '}
                            participantes
                          </span>
                          {registrationEnd && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              {formatRelativeTime(registrationEnd)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                        {isPaid ? (
                          <div className="text-right">
                            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
                              Inscricao
                            </p>
                            <p className="text-lg font-bold text-brand-400">
                              {formatCurrency(battle.entryFee)}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="success">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Gratuita
                          </Badge>
                        )}
                        <ArrowRight className="h-5 w-5 text-surface-600 transition-transform group-hover:translate-x-1 group-hover:text-brand-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
