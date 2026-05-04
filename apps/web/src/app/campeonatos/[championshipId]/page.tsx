'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, ScrollText, Trophy, Users } from 'lucide-react';
import { useCollection, useDocument } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatDate, toDate } from '@batalha/utils';
import { COMPETITION_CATEGORY_LABELS, type Championship, type User } from '@batalha/types';
import {
  getChampionshipEmptyParticipantsCopy,
  getChampionshipParticipantCount,
  getChampionshipParticipantIds,
} from '@/lib/championship-view';

export default function ChampionshipDetailPage({ params }: { params: { championshipId: string } }) {
  const { data: championship, loading: championshipLoading } = useDocument<Championship>(
    'championships',
    params.championshipId,
  );
  const { data: users, loading: usersLoading } = useCollection<User>('users');

  const participantIds = getChampionshipParticipantIds(championship);
  const participantIdSet = new Set(participantIds);
  const participants = users.filter((user) => participantIdSet.has(user.id));
  const participantCount = championship ? getChampionshipParticipantCount(championship) : 0;
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
                <div className="flex flex-shrink-0 flex-col items-start gap-3 sm:items-end">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <a href="#regras">
                    <Button variant="secondary" size="sm">
                      <ScrollText className="mr-2 h-4 w-4" />
                      Ver Regras
                    </Button>
                  </a>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {participantCount > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <Users className="mb-2 h-4 w-4 text-brand-400" />
                    <p className="text-lg font-bold text-white">
                      {participantCount}/{championship.maxParticipants}
                    </p>
                    <p className="text-xs text-surface-500">Competidores</p>
                  </div>
                )}
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

          <section id="regras" className="mt-8 scroll-mt-24">
            <Card>
              <CardContent>
                <div className="mb-4 flex items-center gap-3">
                  <ScrollText className="h-5 w-5 text-brand-400" />
                  <div>
                    <h2 className="text-lg font-bold text-white">Regras</h2>
                    <p className="text-sm text-surface-500">
                      {championship.scope === 'national'
                        ? 'Classificação nacional pela temporada regional'
                        : 'Classificação regional pelas Classificatórias'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(championship.scope === 'national'
                    ? [
                        'Os classificados vêm automaticamente dos resultados regionais da mesma categoria.',
                        'Regionais com 64 participantes classificam o top 10 para o Nacional.',
                        'Regionais menores classificam proporcionalmente conforme o tamanho da chave.',
                        'A etapa nacional usa disputas oficiais por categoria.',
                      ]
                    : [
                        'Até 64 participantes serão classificados através das Classificatórias.',
                        'As Classificatórias usam confrontos 1v1 randômicos por fase.',
                        'Envios fecham às 13:00 BRT no dia da disputa.',
                        'Votação pública acontece das 13:00 às 23:59 BRT.',
                      ]
                  ).map((rule) => (
                    <div
                      key={rule}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <p className="text-sm text-surface-300">{rule}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Participantes</h2>
                <p className="text-sm text-surface-500">Competidores inscritos neste campeonato</p>
              </div>
              <span className="text-sm text-surface-500">{participantCount}</span>
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
                title="Nenhum participante classificado"
                description={getChampionshipEmptyParticipantsCopy(championship)}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
