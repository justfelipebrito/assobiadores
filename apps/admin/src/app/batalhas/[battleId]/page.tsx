'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getClientAuth,
  useCollectionOnce,
  useDocumentOnce,
  where,
} from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatCurrency, formatNumber, toDate } from '@batalha/utils';
import type { Battle, BattleEntry, Submission, User } from '@batalha/types';
import { toast } from 'sonner';
import { getWebApiBaseUrl } from '../../../lib/web-api';
import { AdminBattleConfigModal } from '../admin-battle-config-modal';

function formatDateTime(value: unknown) {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getPublicVoteCount(
  submission:
    | (Submission & { publicVoteCount?: number | null; judgeVoteCount?: number | null })
    | undefined,
) {
  if (!submission) return 0;
  if (typeof submission.publicVoteCount === 'number') return submission.publicVoteCount;
  const judgeVotes = typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
  return Math.max(0, (submission.voteCount ?? 0) - judgeVotes);
}

function getDisplayName({
  entry,
  user,
}: {
  entry?: BattleEntry;
  user?: User;
}) {
  return entry?.userDisplayName || user?.displayName || user?.email || entry?.userId || 'Usuario';
}

export default function AdminBattleDetailPage({ params }: { params: { battleId: string } }) {
  const [emailingWinnerId, setEmailingWinnerId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const { data: battle, loading: battleLoading, refresh: refreshBattle } = useDocumentOnce<Battle>(
    'battles',
    params.battleId,
  );
  const battleConstraints = useMemo(() => [where('battleId', '==', params.battleId)], [params.battleId]);
  const { data: entries, loading: entriesLoading, refresh: refreshEntries } = useCollectionOnce<BattleEntry>(
    'battleEntries',
    battleConstraints,
  );
  const { data: submissions, loading: submissionsLoading, refresh: refreshSubmissions } = useCollectionOnce<Submission>(
    'submissions',
    battleConstraints,
  );
  const { data: users } = useCollectionOnce<User>('users');
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const entriesByUserId = useMemo(
    () => new Map(entries.map((entry) => [entry.userId, entry])),
    [entries],
  );
  const submissionsByUserId = useMemo(
    () => new Map(submissions.map((submission) => [submission.userId, submission])),
    [submissions],
  );
  const winners = useMemo(
    () => [...(battle?.winners ?? [])].sort((a, b) => a.place - b.place),
    [battle?.winners],
  );
  const participantRows = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aWinner = battle?.winners.find((winner) => winner.userId === a.userId);
      const bWinner = battle?.winners.find((winner) => winner.userId === b.userId);
      if (aWinner && bWinner) return aWinner.place - bWinner.place;
      if (aWinner) return -1;
      if (bWinner) return 1;
      return getPublicVoteCount(submissionsByUserId.get(b.userId)) - getPublicVoteCount(submissionsByUserId.get(a.userId));
    });
  }, [battle?.winners, entries, submissionsByUserId]);

  const sendWinnerEmail = async (winnerUserId: string) => {
    setEmailingWinnerId(winnerUserId);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Sessao expirada. Entre novamente.');
      const response = await fetch(
        `${getWebApiBaseUrl()}/api/admin/battles/${params.battleId}/winner-email`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ winnerUserId }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao preparar email do vencedor');
      window.location.href = data.mailtoHref;
      toast.success('Email do vencedor aberto para envio.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao preparar email do vencedor');
    } finally {
      setEmailingWinnerId(null);
    }
  };

  if (battleLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-48" />
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/batalhas" className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
          ← Batalhas
        </Link>
        <EmptyState title="Batalha nao encontrada" description="Confira se a batalha ainda existe." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/batalhas" className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
        ← Batalhas
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant={battle.status === 'finished' ? 'success' : 'default'}>
              {battle.status}
            </Badge>
            <Badge variant={battle.type === 'official' ? 'gold' : 'default'}>{battle.type}</Badge>
            <Badge variant="purple">{battle.category}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-white">{battle.title}</h1>
          <p className="mt-2 max-w-3xl text-surface-400">{battle.description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Button variant="secondary" onClick={() => setConfigOpen(true)}>
            Configurações
          </Button>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
            <p className="text-surface-500">Premio</p>
            <p className="mt-1 text-lg font-bold text-white">{formatCurrency(battle.prizePool ?? 0)}</p>
          </div>
        </div>
      </div>

      {configOpen && (
        <AdminBattleConfigModal
          battle={battle}
          onClose={() => setConfigOpen(false)}
          onSaved={() => {
            setConfigOpen(false);
            refreshBattle();
            refreshEntries();
            refreshSubmissions();
          }}
        />
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-surface-500">Participantes</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {battle.currentParticipants}/{battle.maxParticipants}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-surface-500">Fim da votacao</p>
            <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(battle.votingEnd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-surface-500">Envios aprovados</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {submissions.filter((submission) => submission.status === 'approved').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-sm font-bold text-yellow-400">
            #1
          </div>
          <div>
            <h2 className="font-semibold text-white">Vencedores</h2>
            <p className="text-sm text-surface-500">Use para contato de premiacao e pos-batalha.</p>
          </div>
        </div>
        {winners.length === 0 ? (
          <EmptyState title="Sem vencedor registrado" description="Finalize a batalha para ver os vencedores aqui." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {winners.map((winner) => {
              const user = usersById.get(winner.userId);
              const entry = entriesByUserId.get(winner.userId);

              return (
                <Card key={`${winner.userId}:${winner.place}`}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Badge variant={winner.place === 1 ? 'gold' : 'default'}>
                          #{winner.place}
                        </Badge>
                        <h3 className="mt-3 truncate font-semibold text-white">
                          {getDisplayName({ entry, user })}
                        </h3>
                        <p className="truncate text-sm text-surface-500">{user?.email ?? winner.userId}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 px-2 py-1 text-surface-300">
                            +{formatNumber(winner.points)} pontos
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-surface-300">
                            {formatCurrency(winner.prize)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={emailingWinnerId === winner.userId}
                        onClick={() => sendWinnerEmail(winner.userId)}
                      >
                        Email
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-sm font-bold text-brand-400">
            P
          </div>
          <div>
            <h2 className="font-semibold text-white">Pessoas e envios</h2>
            <p className="text-sm text-surface-500">Participantes, votos e status de envio.</p>
          </div>
        </div>

        {entriesLoading || submissionsLoading ? (
          <Skeleton className="h-56" />
        ) : participantRows.length === 0 ? (
          <EmptyState title="Nenhum participante" description="As pessoas inscritas aparecerao aqui." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Pessoa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">Votos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {participantRows.map((entry) => {
                  const user = usersById.get(entry.userId);
                  const submission = submissionsByUserId.get(entry.userId);
                  const winner = winners.find((item) => item.userId === entry.userId);

                  return (
                    <tr key={entry.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{getDisplayName({ entry, user })}</p>
                        <p className="text-xs text-surface-500">{user?.email ?? entry.userId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={entry.status === 'confirmed' ? 'success' : 'default'}>
                            {entry.status}
                          </Badge>
                          {submission ? (
                            <Badge variant={submission.status === 'approved' ? 'success' : 'warning'}>
                              envio {submission.status}
                            </Badge>
                          ) : (
                            <Badge variant="default">sem envio</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                        {formatNumber(getPublicVoteCount(submission))}
                      </td>
                      <td className="px-4 py-3">
                        {winner ? (
                          <Badge variant={winner.place === 1 ? 'gold' : 'default'}>
                            Vencedor #{winner.place}
                          </Badge>
                        ) : (
                          <span className="text-surface-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
