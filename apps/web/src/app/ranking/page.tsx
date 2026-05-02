'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Medal, Award, Globe, MapPin, ChevronDown, Clock } from 'lucide-react';
import { useCollection, orderBy, limit, where } from '@batalha/firebase';
import { Avatar, Badge, Skeleton, EmptyState } from '@batalha/ui';
import { formatNumber, getRankTier } from '@batalha/utils';
import type { User, BrazilState, Season } from '@batalha/types';

const PLACE_STYLES = [
  { icon: <Crown className="h-5 w-5" />, bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  { icon: <Medal className="h-5 w-5" />, bg: 'from-surface-300/20 to-surface-400/20', border: 'border-surface-300/30', text: 'text-surface-300' },
  { icon: <Award className="h-5 w-5" />, bg: 'from-amber-700/20 to-amber-800/20', border: 'border-amber-700/30', text: 'text-amber-600' },
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

function getUserRankingPoints(user: User, seasonId: string | null) {
  return seasonId ? user.seasonPoints?.[seasonId]?.points ?? 0 : user.points;
}

function getUserRankingRank(user: User, seasonId: string | null) {
  return seasonId ? user.seasonPoints?.[seasonId]?.rank ?? 'Iniciante' : user.rank;
}

function RankingRow({ user, index, seasonId }: { user: User; index: number; seasonId: string | null }) {
  const isTop3 = index < 3;
  const placeStyle = PLACE_STYLES[index];
  const points = getUserRankingPoints(user, seasonId);
  const rank = getUserRankingRank(user, seasonId);
  const tier = getRankTier(points);

  return (
    <Link href={`/perfil/${user.id}`}>
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
          <Avatar src={user.photoURL} name={user.displayName} size="sm" />
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
              {user.state && (
                <span className="flex items-center gap-0.5 text-[10px] text-surface-600">
                  <MapPin className="h-2.5 w-2.5" />
                  {user.state}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold tabular-nums text-white">
            {formatNumber(points)}
          </p>
          <p className="text-xs text-surface-500">pontos</p>
        </div>
      </div>
    </Link>
  );
}

export default function RankingPage() {
  const [scope, setScope] = useState<Scope>('regional');
  const [selectedState, setSelectedState] = useState<BrazilState | ''>('SP');
  const [rankingMode, setRankingMode] = useState<RankingMode>('allTime');

  const { data: activeSeasons } = useCollection<Season>(
    'seasons',
    [where('status', '==', 'active'), orderBy('start', 'desc'), limit(1)],
  );
  const activeSeason = activeSeasons[0] ?? null;
  const seasonId = rankingMode === 'season' && activeSeason ? activeSeason.id : null;
  const pointsField = seasonId ? `seasonPoints.${seasonId}.points` : 'points';

  const nationalConstraints = [orderBy(pointsField, 'desc'), limit(50)];
  const regionalConstraints = seasonId
    ? [orderBy(pointsField, 'desc'), limit(200)]
    : selectedState
    ? [where('state', '==', selectedState), orderBy(pointsField, 'desc'), limit(50)]
    : [orderBy(pointsField, 'desc'), limit(50)];

  const { data: nationalUsers, loading: nationalLoading } = useCollection<User>(
    'users',
    nationalConstraints,
  );

  const { data: regionalUsers, loading: regionalLoading } = useCollection<User>(
    'users',
    regionalConstraints,
  );

  const users =
    scope === 'nacional'
      ? nationalUsers
      : seasonId && selectedState
        ? regionalUsers.filter((user) => user.state === selectedState).slice(0, 50)
        : regionalUsers;
  const loading = scope === 'nacional' ? nationalLoading : regionalLoading;

  const selectedStateLabel = BRAZIL_STATES.find((s) => s.value === selectedState)?.label;

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

      {/* Scope tabs */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            onClick={() => setScope('nacional')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              scope === 'nacional'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-300'
            }`}
          >
            <Globe className="h-4 w-4" />
            Ranking Oficial
          </button>
          <button
            onClick={() => setScope('regional')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              scope === 'regional'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-300'
            }`}
          >
            <MapPin className="h-4 w-4" />
            Ranking Regional
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setRankingMode('allTime')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
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
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                rankingMode === 'season'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-300'
              }`}
            >
              Temporada
            </button>
          </div>

          {scope === 'regional' && (
            <div className="relative">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value as BrazilState | '')}
                className="appearance-none rounded-xl border border-white/10 bg-surface-800 pl-3 pr-8 py-2 text-sm text-white focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              >
                <option value="">Todos os estados</option>
                {BRAZIL_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            </div>
          )}
        </div>
      </div>

      {/* Seasons link */}
      <div className="mt-4 flex justify-end">
        <Link href="/ranking/temporadas" className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors">
          <Clock className="h-3.5 w-3.5" />
          Ver temporadas anteriores
        </Link>
      </div>

      {/* Scope label */}
      <p className="mt-2 text-xs text-surface-500">
        {scope === 'nacional'
          ? seasonId
            ? `Ranking Oficial - Top 50 da temporada ${activeSeason?.name}`
            : 'Ranking Oficial - Top 50 do Brasil'
          : selectedStateLabel
          ? seasonId
            ? `Ranking Regional - Top 50 de ${selectedStateLabel} na temporada ${activeSeason?.name}`
            : `Ranking Regional - Top 50 de ${selectedStateLabel}`
          : 'Escolha um estado para ver o Ranking Regional'}
      </p>

      {/* List */}
      <div className="mt-4 space-y-2">
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
          users.map((user, index) => (
            <RankingRow key={user.id} user={user} index={index} seasonId={seasonId} />
          ))
        )}
      </div>
    </div>
  );
}
