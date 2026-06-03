'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Swords, Users, Clock, ArrowRight, Trophy, Sparkles, Filter } from 'lucide-react';
import { useAuth, useCollectionOnce, orderBy, where } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, Skeleton, EmptyState } from '@batalha/ui';
import { formatCurrency, formatRelativeTime, toDate } from '@batalha/utils';
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type Battle,
  type BattleEntry,
} from '@batalha/types';
import {
  getBattlePrizeAmount,
  getContestantBattles,
  getCreatedBattles,
} from '@/lib/battle-list-view';

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
  { value: 'active', label: 'Em andamento' },
  { value: 'voting', label: 'Em votacao' },
  { value: 'finished', label: 'Finalizadas' },
];

const CATEGORY_OPTIONS: { value: string; label: string }[] = [...COMPETITION_CATEGORIES];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'official', label: 'Oficiais' },
  { value: 'community', label: 'Comunidade' },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-surface-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-surface-900 px-3 text-sm font-medium text-white outline-none transition-colors hover:border-white/20 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/40"
      >
        <option value="all" className="bg-surface-900 text-white" hidden>
          {label}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-900 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BattleListCard({ battle }: { battle: Battle }) {
  const status = STATUS_MAP[battle.status] || STATUS_MAP.finished!;
  const isPaid = battle.entryFee > 0;
  const registrationEnd = toDate(battle.registrationEnd);
  const prizeAmount = getBattlePrizeAmount(battle);

  return (
    <Link href={`/batalhas/${battle.id}`}>
      <Card className="group cursor-pointer">
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant="default">{CATEGORY_MAP[battle.category] || battle.category}</Badge>
                {battle.type === 'official' && (
                  <Badge variant="gold">
                    <Trophy className="mr-1 h-3 w-3" />
                    Oficial
                  </Badge>
                )}
              </div>

              <h3 className="mt-3 text-lg font-semibold text-white transition-colors group-hover:text-brand-400">
                {battle.title}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-surface-400">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {battle.currentParticipants}
                  {battle.maxParticipants > 0 && `/${battle.maxParticipants}`} participantes
                </span>
                {registrationEnd && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatRelativeTime(registrationEnd)}
                  </span>
                )}
                {prizeAmount !== null && (
                  <span className="flex items-center gap-1.5 text-yellow-400">
                    <Trophy className="h-4 w-4" />
                    Prêmio: {formatCurrency(prizeAmount)}
                  </span>
                )}
              </div>
            </div>

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
}

export default function BattlesPage() {
  const { user } = useAuth();
  const [battleScope, setBattleScope] = useState<'all' | 'created' | 'participating'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const {
    data: battles,
    loading,
    error,
  } = useCollectionOnce<Battle>('battles', [orderBy('createdAt', 'desc')]);
  const { data: myBattleEntries, loading: myBattleEntriesLoading } = useCollectionOnce<BattleEntry>(
    user ? 'battleEntries' : undefined,
    user ? [where('userId', '==', user.uid), where('status', '==', 'confirmed')] : [],
  );

  const myCreatedBattles = useMemo(
    () => getCreatedBattles({ battles, userId: user?.uid ?? null }),
    [battles, user?.uid],
  );
  const myParticipationBattles = useMemo(
    () => getContestantBattles({ battles, entries: myBattleEntries }),
    [battles, myBattleEntries],
  );
  const scopedBattles =
    battleScope === 'created'
      ? myCreatedBattles
      : battleScope === 'participating'
        ? myParticipationBattles
        : battles;

  const filtered = useMemo(() => {
    return scopedBattles.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && b.type !== typeFilter) return false;
      return true;
    });
  }, [scopedBattles, statusFilter, categoryFilter, typeFilter]);

  const activeFilterCount = [statusFilter, categoryFilter, typeFilter].filter(
    (f) => f !== 'all',
  ).length;
  const isLoading = loading || (battleScope === 'participating' && myBattleEntriesLoading);

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
      <div className="mt-6 space-y-3">
        {user && (
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'created', label: 'Minhas batalhas' },
              { value: 'participating', label: 'Minhas participações' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setBattleScope(option.value as 'all' | 'created' | 'participating')
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  battleScope === option.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <FilterSelect
            label="Categoria"
            value={categoryFilter}
            options={CATEGORY_OPTIONS}
            onChange={setCategoryFilter}
          />
          <FilterSelect
            label="Tipo"
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={setTypeFilter}
          />
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
        {isLoading ? (
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
                : battleScope === 'created'
                  ? 'Voce ainda nao criou nenhuma batalha'
                  : battleScope === 'participating'
                    ? 'Voce ainda nao participa de nenhuma batalha'
                  : 'Nenhuma batalha disponivel'
            }
            description={
              activeFilterCount > 0
                ? 'Tente ajustar os filtros para ver mais batalhas.'
                : battleScope === 'created'
                  ? 'Quando voce criar uma batalha, ela aparece aqui.'
                  : battleScope === 'participating'
                  ? 'Quando voce entrar, pagar ou aceitar convite de uma batalha, ela aparece aqui.'
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
          filtered.map((battle) => <BattleListCard key={battle.id} battle={battle} />)
        )}
      </div>
    </div>
  );
}
