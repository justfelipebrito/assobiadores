'use client';

import Link from 'next/link';
import {
  Swords, Trophy, Users, ArrowRight, Music, Sparkles,
  Clock, Crown, Medal, Award, TrendingUp, Flame,
} from 'lucide-react';
import { useCollection, orderBy, limit, where } from '@batalha/firebase';
import { Button, Badge, Card, CardContent, Avatar, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber, formatRelativeTime, getRankTier, toDate } from '@batalha/utils';
import type { Battle, User } from '@batalha/types';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }> = {
  registration: { label: 'Inscricoes abertas', variant: 'success' },
  active: { label: 'Em andamento', variant: 'info' },
  voting: { label: 'Em votacao', variant: 'purple' },
  finished: { label: 'Finalizada', variant: 'default' },
};

const PLACE_ICONS = [
  <Crown key="1" className="h-4 w-4 text-yellow-400" />,
  <Medal key="2" className="h-4 w-4 text-surface-300" />,
  <Award key="3" className="h-4 w-4 text-amber-600" />,
];

export default function HomePage() {
  const { data: battles, loading: battlesLoading } = useCollection<Battle>(
    'battles',
    [where('status', 'in', ['registration', 'active', 'voting']), orderBy('createdAt', 'desc'), limit(6)],
  );

  const { data: topUsers, loading: usersLoading } = useCollection<User>(
    'users',
    [orderBy('points', 'desc'), limit(5)],
  );

  const { data: recentWinners, loading: winnersLoading } = useCollection<Battle>(
    'battles',
    [where('status', '==', 'finished'), orderBy('updatedAt', 'desc'), limit(3)],
  );

  const hasActiveBattles = battles.length > 0;
  const hasUsers = topUsers.length > 0;

  return (
    <>
      {/* Compact Hero — just enough to set context */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,169,114,0.12)_0%,_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center">
            <Badge variant="success" className="mb-4 gap-1.5 px-4 py-1.5">
              <Flame className="h-3.5 w-3.5" />
              Ao vivo
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Batalhas de Assobio
            </h1>
            <p className="mt-3 max-w-lg text-surface-400 sm:text-lg">
              Compete, vote e suba no ranking. Veja o que esta rolando agora.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Active Battles */}
        <section>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Batalhas</h2>
                <p className="text-sm text-surface-500">Acontecendo agora</p>
              </div>
            </div>
            <Link href="/batalhas">
              <Button variant="ghost" size="sm">
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {battlesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-52" />
              ))
            ) : hasActiveBattles ? (
              battles.map((battle) => {
                const status = STATUS_MAP[battle.status] || STATUS_MAP.finished!;
                const isPaid = battle.entryFee > 0;
                const regEnd = toDate(battle.registrationEnd);

                return (
                  <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                    <Card className="group h-full cursor-pointer">
                      <CardContent className="flex h-full flex-col">
                        <div className="flex items-center justify-between">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {battle.type === 'official' && (
                            <Badge variant="gold" className="text-[10px]">
                              <Trophy className="mr-1 h-3 w-3" />
                              Oficial
                            </Badge>
                          )}
                        </div>

                        <h3 className="mt-3 flex-1 font-semibold text-white transition-colors group-hover:text-brand-400">
                          {battle.title}
                        </h3>

                        <div className="mt-4 space-y-2 text-sm text-surface-400">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              {battle.currentParticipants} participantes
                            </span>
                            {regEnd && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatRelativeTime(regEnd)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {isPaid ? (
                              <span className="font-semibold text-brand-400">
                                {formatCurrency(battle.entryFee)}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-brand-400">
                                <Sparkles className="h-3.5 w-3.5" />
                                Gratuita
                              </span>
                            )}
                            {battle.prizePool > 0 && (
                              <span className="text-yellow-400">
                                Premio: {formatCurrency(battle.prizePool)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="glass-card text-center">
                  <Music className="mx-auto h-10 w-10 text-surface-600" />
                  <p className="mt-3 font-medium text-surface-300">Nenhuma batalha ativa no momento</p>
                  <p className="mt-1 text-sm text-surface-500">Novas batalhas serao criadas em breve!</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Two columns: Leaderboard + Recent Results */}
        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          {/* Leaderboard */}
          <section className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Ranking</h2>
                  <p className="text-sm text-surface-500">Top assobiadores</p>
                </div>
              </div>
              <Link href="/ranking">
                <Button variant="ghost" size="sm">
                  Ver completo
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <Card className="mt-5">
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="space-y-0 divide-y divide-white/5 p-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="px-4 py-3">
                        <Skeleton className="h-10" />
                      </div>
                    ))}
                  </div>
                ) : hasUsers ? (
                  <div className="divide-y divide-white/5">
                    {topUsers.map((user, index) => {
                      const tier = getRankTier(user.points);
                      return (
                        <Link
                          key={user.id}
                          href={`/perfil/${user.id}`}
                          className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                            {index < 3 ? (
                              PLACE_ICONS[index]
                            ) : (
                              <span className="text-sm font-bold text-surface-600">{index + 1}</span>
                            )}
                          </div>
                          <Avatar src={user.photoURL} name={user.displayName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                              {user.displayName}
                            </p>
                            <p className="text-xs text-surface-500">{user.rank}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold tabular-nums text-white">
                              {formatNumber(user.points)}
                            </p>
                            <p className="text-[10px] text-surface-600">pts</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-surface-500">O ranking aparecera apos as primeiras batalhas.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Recent Results + Stats */}
          <section className="lg:col-span-2 space-y-8">
            {/* Platform Stats */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Plataforma</h2>
                  <p className="text-sm text-surface-500">Numeros gerais</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Assobiadores', value: usersLoading ? '...' : formatNumber(topUsers.length), icon: <Users className="h-4 w-4" /> },
                  { label: 'Batalhas', value: battlesLoading ? '...' : formatNumber(battles.length), icon: <Swords className="h-4 w-4" /> },
                ].map((stat, i) => (
                  <div key={i} className="glass-card text-center">
                    <div className="mx-auto mb-2 inline-flex rounded-lg bg-white/5 p-2 text-surface-400">
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="mt-0.5 text-xs text-surface-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Winners */}
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Ultimos vencedores</h2>
                  <p className="text-sm text-surface-500">Resultados recentes</p>
                </div>
              </div>

              {winnersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : recentWinners.length > 0 ? (
                <div className="space-y-3">
                  {recentWinners.map((battle) => (
                    <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                      <Card className="group cursor-pointer">
                        <CardContent className="py-3">
                          <p className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                            {battle.title}
                          </p>
                          {battle.winners.length > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <Crown className="h-3.5 w-3.5 text-yellow-400" />
                              <span className="text-xs text-surface-400">
                                {battle.winners[0]?.userId}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="glass-card text-center">
                  <p className="text-sm text-surface-500">Nenhuma batalha finalizada ainda.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Bottom CTA — subtle, not the focus */}
        <section className="mt-16 mb-8 text-center">
          <div className="glass-card mx-auto max-w-xl">
            <h3 className="text-lg font-bold text-white">Quer participar?</h3>
            <p className="mt-1 text-sm text-surface-400">
              Crie sua conta gratis e entre na proxima batalha de assobio.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/cadastro">
                <Button size="md" className="w-full sm:w-auto">
                  Criar conta gratis
                </Button>
              </Link>
              <Link href="/batalhas">
                <Button variant="ghost" size="md" className="w-full sm:w-auto">
                  Explorar batalhas
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
