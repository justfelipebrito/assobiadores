'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Medal, Award, Globe, MapPin, ChevronDown } from 'lucide-react';
import { useCollection, orderBy, limit, where } from '@batalha/firebase';
import { Badge, Skeleton, EmptyState } from '@batalha/ui';
import { formatNumber, getRankTier } from '@batalha/utils';
import {
  type BrazilState,
  type Season,
  type SeasonRanking,
} from '@batalha/types';
import {
  getRankingUsers,
  type RankingEntry,
  getUserRankingPoints,
  getUserRankingRank,
  getUserRankingRegion,
  paginateRankingUsers,
} from '@/lib/ranking-view';

const PLACE_STYLES = [
  {
    icon: <Crown className="h-5 w-5" />,
    bg: 'from-yellow-500/20 to-amber-600/20',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
  },
  {
    icon: <Medal className="h-5 w-5" />,
    bg: 'from-surface-300/20 to-surface-400/20',
    border: 'border-surface-300/30',
    text: 'text-surface-300',
  },
  {
    icon: <Award className="h-5 w-5" />,
    bg: 'from-amber-700/20 to-amber-800/20',
    border: 'border-amber-700/30',
    text: 'text-amber-600',
  },
];

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

type Scope = 'nacional' | 'regional';
type RankingMode = 'allTime' | 'season';
const RANKING_PAGE_SIZE = 50;

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase text-surface-500">{children}</p>;
}

function SelectChevron() {
  return (
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
  );
}

function RankingRow({
  user,
  index,
  seasonId,
}: {
  user: RankingEntry;
  index: number;
  seasonId: string | null;
}) {
  const isTop3 = index < 3;
  const placeStyle = PLACE_STYLES[index];
  const points = getUserRankingPoints(user, seasonId);
  const rank = getUserRankingRank(user, seasonId);
  const region = getUserRankingRegion(user);
  const tier = getRankTier(points);

  return (
    <Link href={`/perfil/${'userId' in user ? user.userId : user.id}`}>
      <div
        className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${
          isTop3 && placeStyle
            ? `bg-gradient-to-r ${placeStyle.bg} ${placeStyle.border} hover:brightness-110`
            : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
        }`}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          {isTop3 && placeStyle ? (
            <span className={placeStyle.text}>{placeStyle.icon}</span>
          ) : (
            <span className="text-lg font-bold text-surface-600">{index + 1}</span>
          )}
        </div>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white group-hover:text-brand-400 transition-colors">
              {user.displayName}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge
                variant={tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'default'}
                className="text-[10px]"
              >
                {rank}
              </Badge>
              {region && (
                <span className="flex items-center gap-0.5 text-[10px] text-surface-600">
                  <MapPin className="h-2.5 w-2.5" />
                  {region}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold tabular-nums text-white">{formatNumber(points)}</p>
          <p className="text-xs text-surface-500">pontos</p>
        </div>
      </div>
    </Link>
  );
}

export default function RankingPage() {
  const [scope, setScope] = useState<Scope>('nacional');
  const [selectedState, setSelectedState] = useState<BrazilState | ''>('SP');
  const [rankingMode, setRankingMode] = useState<RankingMode>('allTime');
  const [page, setPage] = useState(1);

  const { data: activeSeasons } = useCollection<Season>('seasons', [
    where('status', '==', 'active'),
    orderBy('start', 'desc'),
    limit(1),
  ]);
  const activeSeason = activeSeasons[0] ?? null;
  const seasonId = activeSeason?.id ?? null;

  const seasonRankingCollection = seasonId ? `seasonRankings/${seasonId}/users` : undefined;
  const { data: seasonRankingUsers, loading: seasonRankingLoading } = useCollection<SeasonRanking>(
    seasonRankingCollection,
    seasonRankingCollection ? [orderBy('totalPoints', 'desc')] : [],
  );
  const rankingUsers = seasonRankingUsers;
  const loading = seasonRankingLoading;

  const users = useMemo(() => {
    return getRankingUsers({
      users: rankingUsers,
      scope,
      selectedState,
      seasonId,
    });
  }, [rankingUsers, scope, seasonId, selectedState]);
  const paginatedUsers = useMemo(
    () =>
      paginateRankingUsers({
        users,
        page,
        pageSize: RANKING_PAGE_SIZE,
      }),
    [page, users],
  );

  useEffect(() => {
    setPage(1);
  }, [scope, selectedState, rankingMode]);

  const selectedStateLabel = BRAZIL_STATES.find((s) => s.value === selectedState)?.label;
  const rankingDescription =
    scope === 'nacional'
      ? rankingMode === 'season' && activeSeason
        ? `Ranking Oficial na ${activeSeason.name}`
        : 'Ranking Oficial Geral'
      : selectedStateLabel
        ? rankingMode === 'season' && activeSeason
          ? `Ranking Regional de ${selectedStateLabel} na ${activeSeason.name}`
          : `Ranking Regional Geral de ${selectedStateLabel}`
        : 'Escolha um estado para ver o Ranking Regional';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 text-yellow-400">
          <Trophy className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Ranking Oficial</h1>
        <p className="mt-1 text-surface-400">Liga nacional e rankings regionais</p>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-white">{rankingDescription}</p>
          {users.length > 0 && (
            <p className="text-xs font-medium text-surface-500">
              {formatNumber(users.length)} assobiadores encontrados
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FilterLabel>Liga</FilterLabel>
              <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-surface-950/60 p-1">
                <button
                  onClick={() => setScope('nacional')}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all ${
                    scope === 'nacional'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-surface-400 hover:text-surface-300'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  Nacional
                </button>
                <button
                  onClick={() => setScope('regional')}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all ${
                    scope === 'regional'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-surface-400 hover:text-surface-300'
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  Regional
                </button>
              </div>
            </div>

            <div>
              <FilterLabel>Periodo</FilterLabel>
              <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-surface-950/60 p-1">
                <button
                  onClick={() => setRankingMode('allTime')}
                  className={`h-10 rounded-lg px-3 text-sm font-medium transition-all ${
                    rankingMode === 'allTime'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-surface-400 hover:text-surface-300'
                  }`}
                >
                  Geral
                </button>
                <button
                  onClick={() => setRankingMode('season')}
                  disabled={!activeSeason}
                  className={`h-10 rounded-lg px-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    rankingMode === 'season'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-surface-400 hover:text-surface-300'
                  }`}
                >
                  Temporada
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <FilterLabel>Regiao</FilterLabel>
              <div className="relative">
                <select
                  value={scope === 'regional' ? selectedState : 'BR'}
                  onChange={(e) => setSelectedState(e.target.value as BrazilState | '')}
                  disabled={scope !== 'regional'}
                  className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-10 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scope === 'regional' ? (
                    <>
                      <option value="">Todos os estados</option>
                      {BRAZIL_STATES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="BR">Brasil</option>
                  )}
                </select>
                <SelectChevron />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-5 space-y-2">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Ranking vazio"
            description={
              scope === 'regional' && selectedState
                ? `Nenhum assobiador de ${selectedStateLabel} no ranking ainda.`
                : 'O ranking sera atualizado conforme as batalhas forem finalizadas.'
            }
          />
        ) : (
          paginatedUsers.items.map((user, index) => (
            <RankingRow
              key={user.id}
              user={user}
              index={(paginatedUsers.page - 1) * paginatedUsers.pageSize + index}
              seasonId={seasonId}
            />
          ))
        )}
      </div>

      {!loading && users.length > RANKING_PAGE_SIZE && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-surface-400">
            Pagina {paginatedUsers.page} de {paginatedUsers.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={paginatedUsers.page <= 1}
              className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((currentPage) => Math.min(paginatedUsers.totalPages, currentPage + 1))
              }
              disabled={paginatedUsers.page >= paginatedUsers.totalPages}
              className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
