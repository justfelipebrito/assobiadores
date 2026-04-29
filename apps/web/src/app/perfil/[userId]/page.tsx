'use client';

import { Trophy, Swords, Star, TrendingUp, Calendar, Music } from 'lucide-react';
import { useDocument } from '@batalha/firebase';
import { Avatar, Badge, StatCard, ProgressBar, Skeleton, EmptyState } from '@batalha/ui';
import { formatNumber, calculateRank, getRankTier, RANKS } from '@batalha/utils';
import type { User } from '@batalha/types';

const RANK_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'from-surface-600/20 to-surface-700/20', text: 'text-surface-400', border: 'border-surface-600/30', glow: '' },
  2: { bg: 'from-green-600/20 to-green-700/20', text: 'text-green-400', border: 'border-green-600/30', glow: '' },
  3: { bg: 'from-brand-500/20 to-brand-600/20', text: 'text-brand-400', border: 'border-brand-500/30', glow: 'shadow-glow-sm' },
  4: { bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]' },
  5: { bg: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]' },
  6: { bg: 'from-amber-500/20 to-amber-600/20', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]' },
  7: { bg: 'from-yellow-400/20 to-red-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-[0_0_25px_-5px_rgba(234,179,8,0.4)]' },
};

function getNextRankPoints(currentPoints: number): { current: number; next: number; name: string } {
  for (let i = 0; i < RANKS.length - 1; i++) {
    if (currentPoints < RANKS[i + 1]!.minPoints) {
      return {
        current: currentPoints - RANKS[i]!.minPoints,
        next: RANKS[i + 1]!.minPoints - RANKS[i]!.minPoints,
        name: RANKS[i + 1]!.name,
      };
    }
  }
  return { current: 1, next: 1, name: 'Lenda do Assobio' };
}

export default function ProfilePage({ params }: { params: { userId: string } }) {
  const { data: user, loading } = useDocument<User>('users', params.userId);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20">
        <EmptyState
          title="Usuario nao encontrado"
          description="Este perfil nao existe ou foi removido."
        />
      </div>
    );
  }

  const tier = getRankTier(user.points);
  const rankColor = RANK_COLORS[tier] || RANK_COLORS[1]!;
  const progress = getNextRankPoints(user.points);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
        {/* Banner gradient */}
        <div className={`absolute inset-0 h-36 bg-gradient-to-br ${rankColor.bg} opacity-60`} />
        <div className="absolute inset-0 h-36 bg-gradient-to-t from-surface-950/80 to-transparent" />

        <div className="relative px-6 pb-6 pt-20 sm:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
            {/* Avatar */}
            <div className={`-mt-12 rounded-full border-4 ${rankColor.border} ${rankColor.glow} bg-surface-950 p-1`}>
              <Avatar
                src={user.photoURL}
                name={user.displayName}
                size="xl"
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-white">{user.displayName}</h1>
              {user.bio && (
                <p className="mt-1 text-sm text-surface-400">{user.bio}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge variant={tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'success'}>
                  {user.rank}
                </Badge>
                <Badge variant="default">
                  {formatNumber(user.points)} pts
                </Badge>
              </div>
            </div>
          </div>

          {/* XP Progress */}
          <div className="mt-6">
            <ProgressBar
              value={progress.current}
              max={progress.next}
              label={`Proximo: ${progress.name}`}
              showValue
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard
          icon={<Swords className="h-5 w-5" />}
          label="Batalhas"
          value={formatNumber(user.stats.battlesEntered)}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Vitorias"
          value={formatNumber(user.stats.battlesWon)}
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Top 3"
          value={formatNumber(user.stats.topThreeFinishes)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Votos recebidos"
          value={formatNumber(user.stats.totalVotesReceived)}
        />
      </div>

      {/* Badges section */}
      {user.badges.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Conquistas</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {user.badges.map((badge) => (
              <div
                key={badge}
                className="glass-card flex flex-col items-center p-4 text-center"
              >
                <div className="mb-2 text-2xl">🏅</div>
                <span className="text-xs font-medium text-surface-400">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battle history placeholder */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Historico de Batalhas</h2>
        <EmptyState
          icon={<Calendar className="h-10 w-10" />}
          title="Nenhuma batalha ainda"
          description="O historico de batalhas aparecera aqui."
        />
      </div>
    </div>
  );
}
