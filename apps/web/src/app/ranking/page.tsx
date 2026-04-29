'use client';

import Link from 'next/link';
import { Trophy, Crown, Medal, Award } from 'lucide-react';
import { useCollection, orderBy, limit } from '@batalha/firebase';
import { Avatar, Badge, Skeleton, EmptyState } from '@batalha/ui';
import { formatNumber, getRankTier } from '@batalha/utils';
import type { User } from '@batalha/types';

const PLACE_STYLES = [
  { icon: <Crown className="h-5 w-5" />, bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  { icon: <Medal className="h-5 w-5" />, bg: 'from-surface-300/20 to-surface-400/20', border: 'border-surface-300/30', text: 'text-surface-300' },
  { icon: <Award className="h-5 w-5" />, bg: 'from-amber-700/20 to-amber-800/20', border: 'border-amber-700/30', text: 'text-amber-600' },
];

export default function RankingPage() {
  const { data: users, loading } = useCollection<User>(
    'users',
    [orderBy('points', 'desc'), limit(50)],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 text-yellow-400">
          <Trophy className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-white">Ranking</h1>
        <p className="mt-1 text-surface-400">Os melhores assobiadores do Brasil</p>
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Ranking vazio"
            description="O ranking sera atualizado conforme as batalhas forem finalizadas."
          />
        ) : (
          <div className="space-y-2">
            {users.map((user, index) => {
              const isTop3 = index < 3;
              const placeStyle = PLACE_STYLES[index];
              const tier = getRankTier(user.points);

              return (
                <Link key={user.id} href={`/perfil/${user.id}`}>
                  <div
                    className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${
                      isTop3 && placeStyle
                        ? `bg-gradient-to-r ${placeStyle.bg} ${placeStyle.border} hover:brightness-110`
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Position */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                      {isTop3 && placeStyle ? (
                        <span className={placeStyle.text}>{placeStyle.icon}</span>
                      ) : (
                        <span className="text-lg font-bold text-surface-600">{index + 1}</span>
                      )}
                    </div>

                    {/* Avatar + Name */}
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <Avatar
                        src={user.photoURL}
                        name={user.displayName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white group-hover:text-brand-400 transition-colors">
                          {user.displayName}
                        </p>
                        <Badge
                          variant={tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'default'}
                          className="mt-0.5 text-[10px]"
                        >
                          {user.rank}
                        </Badge>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold tabular-nums text-white">
                        {formatNumber(user.points)}
                      </p>
                      <p className="text-xs text-surface-500">pontos</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
