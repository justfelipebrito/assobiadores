'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, Trophy, Users } from 'lucide-react';
import { useCollection, useDocument } from '@batalha/firebase';
import { Badge, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatDate, toDate } from '@batalha/utils';
import { COMPETITION_CATEGORY_LABELS, type Championship, type User } from '@batalha/types';
import { getChampionshipParticipantIds } from '@/lib/championship-view';

export default function ChampionshipDetailPage({ params }: { params: { championshipId: string } }) {
  const { data: championship, loading: championshipLoading } = useDocument<Championship>(
    'championships',
    params.championshipId,
  );
  const { data: users, loading: usersLoading } = useCollection<User>('users');

  const participantIds = getChampionshipParticipantIds(championship);
  const participantIdSet = new Set(participantIds);
  const participants = users.filter((user) => participantIdSet.has(user.id));
  const start = toDate(championship?.schedule.start);
  const end = toDate(championship?.schedule.end);
  const loading = championshipLoading || usersLoading;

  if (!championshipLoading && !championship) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/campeonatos"
          className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Campeonatos
        </Link>
        <EmptyState
          icon={<Trophy className="h-12 w-12" />}
          title="Campeonato não encontrado"
          description="Esse campeonato não existe ou ainda não foi publicado."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/campeonatos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Campeonatos
      </Link>

      {championshipLoading || !championship ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <Card>
            <CardContent>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={championship.scope === 'national' ? 'gold' : 'purple'}>
                      {championship.scope === 'national' ? 'Nacional' : championship.region}
                    </Badge>
                    <Badge variant="default">
                      {COMPETITION_CATEGORY_LABELS[championship.category]}
                    </Badge>
                    <Badge variant="default">{championship.status}</Badge>
                  </div>
                  <h1 className="mt-4 text-2xl font-bold text-white">{championship.title}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-surface-400">
                    {championship.description}
                  </p>
                </div>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                  <Trophy className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <Users className="mb-2 h-4 w-4 text-brand-400" />
                  <p className="text-lg font-bold text-white">
                    {championship.currentParticipants}/{championship.maxParticipants}
                  </p>
                  <p className="text-xs text-surface-500">Competidores</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <Calendar className="mb-2 h-4 w-4 text-brand-400" />
                  <p className="text-sm font-semibold text-white">
                    {start ? formatDate(start) : 'Data pendente'}
                  </p>
                  <p className="text-xs text-surface-500">
                    {end ? `Até ${formatDate(end)}` : 'Encerramento pendente'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <MapPin className="mb-2 h-4 w-4 text-brand-400" />
                  <p className="text-sm font-semibold text-white">
                    {championship.scope === 'national' ? 'Brasil' : championship.region}
                  </p>
                  <p className="text-xs text-surface-500">Abrangência</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Participantes</h2>
                <p className="text-sm text-surface-500">Competidores inscritos neste campeonato</p>
              </div>
              <span className="text-sm text-surface-500">{participants.length}</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16" />
                ))}
              </div>
            ) : participants.length > 0 ? (
              <div className="space-y-3">
                {participants.map((participant, index) => (
                  <Link key={participant.id} href={`/perfil/${participant.id}`}>
                    <Card className="group cursor-pointer">
                      <CardContent className="flex items-center gap-4 py-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-sm font-bold text-surface-600">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-white transition-colors group-hover:text-brand-400">
                            {participant.displayName}
                          </p>
                          <p className="truncate text-xs text-surface-500">
                            {participant.rank}
                            {participant.state ? ` - ${participant.state}` : ''}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="h-12 w-12" />}
                title="Nenhum participante inscrito"
                description="Os participantes aparecerão aqui quando as inscrições forem confirmadas."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
