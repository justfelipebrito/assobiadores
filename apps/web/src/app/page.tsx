'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  ChevronDown,
  Clock,
  Crown,
  Flame,
  Globe,
  MapPin,
  Medal,
  Music,
  Sparkles,
  Swords,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react';
import { limit, orderBy, useAuth, useCollection } from '@batalha/firebase';
import { Avatar, Badge, Button, Card, CardContent, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber, formatRelativeTime, toDate } from '@batalha/utils';
import type { Battle, BrazilState, Submission, User } from '@batalha/types';
import { VideoPreview } from '@/components/video/video-preview';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple' }
> = {
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

const BRAZIL_STATES: { value: BrazilState; label: string }[] = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapa' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceara' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espirito Santo' },
  { value: 'GO', label: 'Goias' },
  { value: 'MA', label: 'Maranhao' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Para' },
  { value: 'PB', label: 'Paraiba' },
  { value: 'PR', label: 'Parana' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piaui' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondonia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'Sao Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

function RankingList({
  users,
  loading,
  emptyLabel,
}: {
  users: User[];
  loading: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-white/5 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-3 py-3">
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-surface-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {users.map((user, index) => (
        <Link
          key={user.id}
          href={`/perfil/${user.id}`}
          className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
            {index < 3 ? (
              PLACE_ICONS[index]
            ) : (
              <span className="text-sm font-bold text-surface-600">{index + 1}</span>
            )}
          </div>
          <Avatar src={user.photoURL} name={user.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
              {user.displayName}
            </p>
            <p className="truncate text-xs text-surface-500">
              {user.rank}
              {user.state ? ` - ${user.state}` : ''}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-white">{formatNumber(user.points)}</p>
            <p className="text-[10px] text-surface-600">pts</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [selectedRegionalState, setSelectedRegionalState] = useState<BrazilState>('SP');
  const { user, loading: authLoading } = useAuth();
  const { data: battles, loading: battlesLoading } = useCollection<Battle>('battles', [
    orderBy('createdAt', 'desc'),
    limit(12),
  ]);

  const { data: nationalUsers, loading: nationalUsersLoading } = useCollection<User>('users', [
    orderBy('points', 'desc'),
    limit(20),
  ]);

  const { data: regionalRankingCandidates, loading: regionalUsersLoading } = useCollection<User>(
    'users',
    [orderBy('points', 'desc'), limit(200)],
  );
  const { data: highlightUsers } = useCollection<User>('users', [limit(100)]);

  const { data: highlightedSubmissions, loading: highlightsLoading } = useCollection<Submission>(
    'submissions',
    [orderBy('createdAt', 'desc'), limit(24)],
  );

  const { data: recentlyUpdatedBattles, loading: winnersLoading } = useCollection<Battle>(
    'battles',
    [orderBy('updatedAt', 'desc'), limit(8)],
  );

  const activeBattles = useMemo(
    () =>
      battles
        .filter((battle) => ['registration', 'active', 'voting'].includes(battle.status))
        .slice(0, 6),
    [battles],
  );
  const recentWinners = useMemo(
    () => recentlyUpdatedBattles.filter((battle) => battle.status === 'finished').slice(0, 3),
    [recentlyUpdatedBattles],
  );
  const dailyHighlights = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const approved = highlightedSubmissions.filter(
      (submission) => submission.status === 'approved',
    );
    const todaysApproved = approved.filter((submission) => {
      const createdAt = toDate(submission.createdAt);
      return createdAt ? createdAt.getTime() >= todayStart.getTime() : false;
    });
    const source = todaysApproved.length >= 3 ? todaysApproved : approved;

    return [...source]
      .sort((a, b) => {
        const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
        if (voteDiff !== 0) return voteDiff;

        const aCreatedAt = toDate(a.createdAt)?.getTime() ?? 0;
        const bCreatedAt = toDate(b.createdAt)?.getTime() ?? 0;
        return bCreatedAt - aCreatedAt;
      })
      .slice(0, 3);
  }, [highlightedSubmissions]);
  const featuredHighlight = dailyHighlights[0];
  const secondaryHighlights = dailyHighlights.slice(1, 3);
  const highlightUsersById = useMemo(
    () => new Map(highlightUsers.map((user) => [user.id, user.displayName])),
    [highlightUsers],
  );
  const highlightsMoreHref = featuredHighlight
    ? `/batalhas/${featuredHighlight.battleId}/votar`
    : '/batalhas';

  const hasActiveBattles = activeBattles.length > 0;
  const regionalUsers = useMemo(
    () =>
      regionalRankingCandidates
        .filter((regionalUser) => regionalUser.state === selectedRegionalState)
        .slice(0, 20),
    [regionalRankingCandidates, selectedRegionalState],
  );
  const selectedRegionalStateLabel =
    BRAZIL_STATES.find((state) => state.value === selectedRegionalState)?.label ?? 'Sao Paulo';

  return (
    <>
      <section className="border-b border-white/5 bg-surface-950">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Destaques Diários</h1>
                <p className="text-sm text-surface-500">
                  Videos em destaque escolhidos pelos votos da comunidade
                </p>
              </div>
            </div>
            <Link href={highlightsMoreHref}>
              <Button variant="ghost" size="sm">
                Ver mais
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {highlightsLoading ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
              <Skeleton className="h-[360px]" />
              <div className="grid gap-4">
                <Skeleton className="h-[172px]" />
                <Skeleton className="h-[172px]" />
              </div>
            </div>
          ) : featuredHighlight ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <VideoPreview url={featuredHighlight.videoURL} />
                  <div className="space-y-4 p-5">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {featuredHighlight.userDisplayName ||
                          highlightUsersById.get(featuredHighlight.userId) ||
                          'Assobiador'}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-surface-500">
                        {formatNumber(featuredHighlight.voteCount)} votos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {secondaryHighlights.map((submission, index) => (
                  <Card key={submission.id} className="overflow-hidden">
                    <CardContent className="grid gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)]">
                      <VideoPreview url={submission.videoURL} />
                      <div className="flex min-w-0 flex-col justify-between gap-3">
                        <div>
                          <h3 className="line-clamp-2 font-semibold text-white">
                            {submission.userDisplayName ||
                              highlightUsersById.get(submission.userId) ||
                              'Assobiador'}
                          </h3>
                          <p className="mt-1 text-xs font-medium text-surface-500">
                            {formatNumber(submission.voteCount)} votos
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {secondaryHighlights.length < 2 &&
                  Array.from({ length: 2 - secondaryHighlights.length }).map((_, index) => (
                    <div
                      key={`empty-highlight-${index}`}
                      className="flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center"
                    >
                      <p className="text-sm text-surface-500">
                        Mais videos aparecem conforme a comunidade vota.
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="glass-card text-center">
              <Music className="mx-auto h-10 w-10 text-surface-600" />
              <p className="text-sm text-surface-500">
                Os destaques diarios aparecem quando houver videos aprovados e votados.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {battlesLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)
              ) : hasActiveBattles ? (
                activeBattles.map((battle) => {
                  const status = STATUS_MAP[battle.status] || STATUS_MAP.finished!;
                  const isPaid = battle.entryFee > 0;
                  const regEnd = toDate(battle.registrationEnd);

                  return (
                    <Link key={battle.id} href={`/batalhas/${battle.id}`}>
                      <Card className="group h-full cursor-pointer">
                        <CardContent className="flex h-full flex-col">
                          <div className="flex items-center justify-between gap-2">
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
                            <div className="flex items-center justify-between gap-3">
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
                            <div className="flex items-center justify-between gap-3">
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
                <div className="sm:col-span-2">
                  <div className="glass-card text-center">
                    <Music className="mx-auto h-10 w-10 text-surface-600" />
                    <p className="mt-3 font-medium text-surface-300">
                      Nenhuma batalha ativa no momento
                    </p>
                    <p className="mt-1 text-sm text-surface-500">
                      Novas batalhas serao criadas em breve.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 self-start space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Rankings</h2>
                <p className="text-sm text-surface-500">Top 20 por liga</p>
              </div>
            </div>
            <Link href="/ranking">
              <Button variant="ghost" size="sm">
                Ver
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-brand-400" />
                  <h3 className="font-semibold text-white">Ranking Nacional</h3>
                </div>
                <p className="mt-1 text-xs text-surface-500">Top 20 do Brasil</p>
              </div>
              <RankingList
                users={nationalUsers}
                loading={nationalUsersLoading}
                emptyLabel="O ranking nacional aparecera apos as primeiras batalhas."
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-400" />
                  <h3 className="font-semibold text-white">Ranking Regional</h3>
                </div>
                <p className="mt-1 text-xs text-surface-500">
                  Top 20 de {selectedRegionalStateLabel}
                </p>
                <div className="relative mt-3">
                  <select
                    value={selectedRegionalState}
                    onChange={(event) =>
                      setSelectedRegionalState(event.target.value as BrazilState)
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-surface-900 px-3 pr-9 text-sm font-medium text-white outline-none transition-colors focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50"
                  >
                    {BRAZIL_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                </div>
              </div>
              <RankingList
                users={regionalUsers}
                loading={regionalUsersLoading}
                emptyLabel={`O ranking regional de ${selectedRegionalStateLabel} ainda nao tem participantes.`}
              />
            </CardContent>
          </Card>

          <section>
            <div className="mb-4 flex items-center gap-3">
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
                {
                  label: 'Assobiadores',
                  value: formatNumber(highlightUsers.length),
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: 'Batalhas',
                  value: battlesLoading ? '...' : formatNumber(battles.length),
                  icon: <Swords className="h-4 w-4" />,
                },
              ].map((stat) => (
                <div key={stat.label} className="glass-card text-center">
                  <div className="mx-auto mb-2 inline-flex rounded-lg bg-white/5 p-2 text-surface-400">
                    {stat.icon}
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-surface-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
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
                        <p className="text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
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
          </section>
        </aside>

        {!authLoading && !user && (
          <section className="text-center lg:col-span-2">
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
        )}
      </div>
    </>
  );
}
