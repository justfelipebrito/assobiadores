'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Headphones,
  Lock,
  Music,
  Send,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { useAuth, useCollection, useDocument, where } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Input, Skeleton } from '@batalha/ui';
import { formatCurrency, formatDateTime, formatRelativeTime, toDate } from '@batalha/utils';
import type { Battle, BattleEntry, Payment, Submission, Vote as BattleVote } from '@batalha/types';
import { PixPayment } from '@/components/payments/pix-payment';
import { MediaPreview } from '@/components/media/media-preview';
import { SubmitBattleAudioModal } from '@/components/battles/submit-battle-audio-modal';
import {
  canSubmitBattleEntry,
  getBattleRuleCards,
  getBattleScheduleItems,
  getBattleSubmissionResultBreakdown,
  sortBattleEntriesByCreatedAt,
  sortBattleEntriesForDisplay,
  sortBattleSubmissionsByVoteCount,
} from '@/lib/battle-detail-view';
import {
  getBattleSubmissionVoteState,
  getBattleVoteForUser,
  getBattleWinnerBadgeLabel,
  getBattleWinnerForSubmission,
} from '@/lib/battle-vote-view';
import { toast } from 'sonner';

function InvitePanel({ battleId }: { battleId: string }) {
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSending(true);
    try {
      const { getClientAuth } = await import('@batalha/firebase');
      const token = await getClientAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/battles/${battleId}/invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar convite');
      toast.success(`Convite enviado para @${data.toUsername}!`);
      setUsername('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Convidar participante</h3>
        </div>
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            placeholder="@username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-2 text-xs text-surface-600">Digite o username exato do participante.</p>
      </CardContent>
    </Card>
  );
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'info' | 'default' | 'purple';
    description: string;
  }
> = {
  draft: { label: 'Rascunho', variant: 'default', description: 'Esta batalha ainda nao foi publicada.' },
  registration: { label: 'Inscricoes abertas', variant: 'success', description: 'Participantes podem entrar agora.' },
  active: { label: 'Envios abertos', variant: 'info', description: 'Participantes enviam seus assobios.' },
  voting: { label: 'Em votacao', variant: 'purple', description: 'Votos abertos conforme a regra da batalha.' },
  finished: { label: 'Finalizada', variant: 'default', description: 'Resultado encerrado.' },
};

function getEntryName(entry: BattleEntry) {
  return entry.userDisplayName || entry.userId;
}

export default function BattleDetailPage({ params }: { params: { battleId: string } }) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<Submission | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [payment, setPayment] = useState<{
    paymentId: string;
    pixQrCode: string;
    pixCopiaECola: string;
    expiresAt: string;
  } | null>(null);

  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const { data: entries, loading: entriesLoading } = useCollection<BattleEntry>('battleEntries', [
    where('battleId', '==', params.battleId),
  ]);
  const { data: submissions, loading: submissionsLoading } = useCollection<Submission>(
    'submissions',
    [
      where('battleId', '==', params.battleId),
      where('status', '==', 'approved'),
    ],
  );
  const { data: approvedPayments } = useCollection<Payment>(
    user ? 'payments' : undefined,
    user
      ? [
          where('battleId', '==', params.battleId),
          where('userId', '==', user.uid),
          where('status', '==', 'approved'),
        ]
      : [],
  );
  const { data: currentUserVotes } = useCollection<BattleVote>(
    user ? 'votes' : undefined,
    user
      ? [where('battleId', '==', params.battleId), where('voterId', '==', user.uid)]
      : [],
  );

  const confirmedEntries = useMemo(
    () => sortBattleEntriesByCreatedAt(entries.filter((entry) => entry.status === 'confirmed')),
    [entries],
  );
  const submissionsByUserId = useMemo(() => {
    const map = new Map<string, Submission>();
    sortBattleSubmissionsByVoteCount(submissions).forEach((submission) =>
      map.set(submission.userId, submission),
    );
    return map;
  }, [submissions]);
  const displayEntries = useMemo(
    () =>
      battle
        ? sortBattleEntriesForDisplay({
            battle,
            entries: confirmedEntries,
            submissionsByUserId,
          })
        : confirmedEntries,
    [battle, confirmedEntries, submissionsByUserId],
  );
  const currentUserEntry = useMemo(
    () => confirmedEntries.find((entry) => user && entry.userId === user.uid) ?? null,
    [confirmedEntries, user],
  );
  const currentUserSubmission = useMemo(
    () => submissions.find((submission) => user && submission.userId === user.uid) ?? null,
    [submissions, user],
  );
  const latestApprovedPayment = useMemo(() => {
    const datedPayments = approvedPayments
      .map((approvedPayment) => {
        const paidAt =
          toDate(approvedPayment.webhookReceivedAt) ??
          toDate(approvedPayment.updatedAt) ??
          toDate(approvedPayment.createdAt);
        return paidAt;
      })
      .filter((paidAt): paidAt is Date => paidAt !== null);

    return datedPayments.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  }, [approvedPayments]);
  const currentUserVote = useMemo(
    () => getBattleVoteForUser(currentUserVotes),
    [currentUserVotes],
  );

  const loading = battleLoading || entriesLoading || submissionsLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="py-20">
        <EmptyState
          title="Batalha nao encontrada"
          description="Esta batalha nao existe ou foi removida."
          action={
            <Link href="/batalhas">
              <Button variant="secondary">Ver batalhas</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const currentBattle = battle;
  const status = STATUS_CONFIG[currentBattle.status] || STATUS_CONFIG.finished!;
  const isPaid = currentBattle.entryFee > 0;
  const isInviteOnly = currentBattle.visibility === 'invite_only';
  const isCreator = Boolean(user && currentBattle.createdBy === user.uid);
  const canSubmitEntry = canSubmitBattleEntry({
    battle: currentBattle,
    hasConfirmedEntry: Boolean(currentUserEntry),
    hasSubmission: Boolean(currentUserSubmission),
  });
  const canPublicJoin =
    currentBattle.status === 'registration' &&
    !isInviteOnly &&
    !isCreator &&
    (!user || !currentUserEntry) &&
    (!currentBattle.maxParticipants || confirmedEntries.length < currentBattle.maxParticipants);

  async function getToken() {
    const { getClientAuth } = await import('@batalha/firebase');
    const token = await getClientAuth().currentUser?.getIdToken();
    if (!token) throw new Error('Faca login para continuar');
    return token;
  }

  async function handleJoin() {
    if (!user) {
      toast.error('Faca login para participar.');
      return;
    }

    setJoining(true);
    try {
      const token = await getToken();
      const res = await fetch(isPaid ? '/api/payments/create' : '/api/battle-entries/free', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ battleId: currentBattle.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nao foi possivel participar');

      if (isPaid) {
        setPayment({
          paymentId: data.paymentId,
          pixQrCode: data.pixQrCode,
          pixCopiaECola: data.pixCopiaECola,
          expiresAt: data.expiresAt,
        });
        return;
      }

      toast.success('Participacao confirmada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao participar');
    } finally {
      setJoining(false);
    }
  }

  function canVoteOnSubmission(submission: Submission) {
    if (!user || currentBattle.status !== 'voting') return false;
    if (submission.userId === user.uid) return false;
    if (currentUserEntry) return false;
    if (currentBattle.createdBy === user.uid) return true;
    return true;
  }

  async function handleVote(submissionId: string) {
    if (!user) {
      toast.error('Faca login para votar.');
      return;
    }

    setVotingId(submissionId);
    try {
      const token = await getToken();
      const res = await fetch('/api/votes/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ battleId: currentBattle.id, submissionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao votar');
      toast.success('Voto confirmado.');
      setPendingVote(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao votar');
    } finally {
      setVotingId(null);
    }
  }

  async function handleFinalize() {
    if (!user) return;

    setFinalizing(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/battles/${currentBattle.id}/finalize`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar batalha');
      toast.success('Batalha finalizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar batalha');
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
      <Link
        href="/batalhas"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Todas as batalhas
      </Link>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-accent-500/5" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {battle.type === 'official' && (
              <Badge variant="gold">
                <Trophy className="mr-1 h-3 w-3" />
                Oficial
              </Badge>
            )}
            <Badge variant="default">{battle.category}</Badge>
            {isInviteOnly && (
              <Badge variant="default">
                <Lock className="mr-1 h-3 w-3" />
                Convite
              </Badge>
            )}
          </div>

          <div className="mt-4">
            <h1 className="text-3xl font-bold text-white">{battle.title}</h1>
            <p className="mt-2 max-w-3xl text-surface-400 leading-relaxed">{battle.description}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-surface-300">
              <Users className="h-4 w-4 text-brand-400" />
              {confirmedEntries.length}
              {battle.maxParticipants > 0 && ` / ${battle.maxParticipants}`} participantes
            </div>
            {isPaid && (
              <div className="flex items-center gap-2 text-surface-300">
                <Sparkles className="h-4 w-4 text-brand-400" />
                Inscrição:{' '}
                <span className="font-semibold text-brand-400">
                  {formatCurrency(battle.entryFee)}
                </span>
              </div>
            )}
            {battle.prizePool > 0 && (
              <div className="flex items-center gap-2 text-surface-300">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Prêmio:{' '}
                <span className="font-semibold text-yellow-400">
                  {formatCurrency(battle.prizePool)}
                </span>
              </div>
            )}
          </div>

          {latestApprovedPayment && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-400/20 bg-brand-500/10 px-3 py-2 text-sm text-brand-100">
              <CheckCircle2 className="h-4 w-4 text-brand-400" />
              Entrada paga em {formatDateTime(latestApprovedPayment)}
            </div>
          )}

          {canPublicJoin && (
            <div className="mt-6">
              <Button onClick={handleJoin} loading={joining}>
                {isPaid ? <CreditCard className="mr-2 h-4 w-4" /> : <Swords className="mr-2 h-4 w-4" />}
                {isPaid ? 'Pagar entrada' : 'Participar'}
              </Button>
            </div>
          )}

          {isCreator && currentBattle.status === 'voting' && (
            <div className="mt-6">
              <Button variant="secondary" onClick={handleFinalize} loading={finalizing}>
                <Trophy className="mr-2 h-4 w-4" />
                Finalizar batalha
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold text-white">Cronograma</h2>
            <div className="space-y-4">
              {getBattleScheduleItems(battle).map((item) => {
                const Icon = item.icon;
                return (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-surface-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-sm text-surface-500">
                      {item.date ? formatDateTime(item.date) : 'A definir'}
                    </p>
                  </div>
                  {item.date && (
                    <span className="text-xs text-surface-500">{formatRelativeTime(item.date)}</span>
                  )}
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex h-full flex-col gap-4">
          <Card className="flex-1">
            <CardContent>
              <h2 className="mb-4 text-lg font-semibold text-white">Regras</h2>
              <div className="mb-4 space-y-3">
                {getBattleRuleCards(battle).map((ruleCard) => (
                  <div
                    key={ruleCard.title}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">
                      {ruleCard.title}
                    </p>
                    <p className="mt-1 text-sm text-surface-300">{ruleCard.description}</p>
                  </div>
                ))}
              </div>
              {battle.rules.length > 0 && (
                <ul className="space-y-3">
                  {battle.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                      {rule}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {user && battle.createdBy === user.uid && battle.status === 'registration' && (
            <InvitePanel battleId={battle.id} />
          )}
        </div>
      </div>

      <section className="mt-6">
        <Card>
          <CardContent>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Participantes</h2>
                <p className="mt-1 text-sm text-surface-500">
                  Assobios enviados aparecem direto aqui.
                </p>
              </div>
              {canSubmitEntry && (
                <Button size="sm" variant="secondary" onClick={() => setSubmitOpen(true)}>
                  <Music className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              )}
            </div>

            {confirmedEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-surface-500">
                Ainda nao ha participantes confirmados.
              </div>
            ) : (
              <div className="space-y-4">
                {displayEntries.map((entry) => {
                  const submission = submissionsByUserId.get(entry.userId);
                  const winner = getBattleWinnerForSubmission({ battle, submission: submission ?? null });
                  const resultBreakdown = submission
                    ? getBattleSubmissionResultBreakdown(submission)
                    : null;
                  const voteState = submission
                    ? getBattleSubmissionVoteState({
                        submissionId: submission.id,
                        currentVote: currentUserVote,
                        canVote: canVoteOnSubmission(submission),
                      })
                    : null;

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-2xl border p-4 ${
                        winner?.place === 1
                          ? 'border-yellow-400/30 bg-yellow-400/5'
                          : voteState?.isSelectedVote
                            ? 'border-brand-500/40 bg-brand-500/10'
                            : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{getEntryName(entry)}</h3>
                            {winner && (
                              <Badge variant={winner.place === 1 ? 'gold' : 'default'}>
                                <Trophy className="mr-1 h-3 w-3" />
                                {getBattleWinnerBadgeLabel()}
                              </Badge>
                            )}
                            {voteState?.isSelectedVote && (
                              <Badge variant="success">Seu voto</Badge>
                            )}
                            {submission ? (
                              <Badge variant="success">Enviado</Badge>
                            ) : (
                              <Badge variant="default">Aguardando</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-surface-500">
                            {entry.status === 'confirmed' ? 'Participante confirmado' : entry.status}
                          </p>
                        </div>

                        {submission && battle.status === 'voting' && (
                          voteState?.isSelectedVote ? (
                            <Badge variant="success" className="px-3 py-2">
                              Seu voto
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPendingVote(submission)}
                              loading={votingId === submission.id}
                              disabled={!voteState?.canVote}
                            >
                              <Vote className="mr-2 h-4 w-4" />
                              {voteState?.buttonLabel ?? 'Votar'}
                            </Button>
                          )
                        )}
                      </div>

                      {winner && (
                        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-surface-950/40 px-4 py-3 text-sm text-surface-300 sm:grid-cols-2">
                          <span>
                            Pontuação Ranking:{' '}
                            <span className="font-semibold text-white">+{winner.points}</span>
                          </span>
                          {winner.prize > 0 && (
                            <span>
                              Prêmio:{' '}
                              <span className="font-semibold text-yellow-400">
                                {formatCurrency(winner.prize)}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      {submission ? (
                        <div className="mt-4">
                          {battle.status === 'finished' && resultBreakdown && (
                            <div className="mb-3 flex flex-wrap gap-2 text-xs text-surface-300">
                              <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                                Comunidade: {resultBreakdown.publicVoteCount}{' '}
                                {resultBreakdown.publicVoteCount === 1 ? 'voto' : 'votos'}
                              </span>
                              {resultBreakdown.hasCreatorVote && (
                                <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                                  Voto do Criador
                                </span>
                              )}
                            </div>
                          )}
                          <MediaPreview
                            mediaType={submission.mediaType}
                            mediaURL={submission.mediaURL}
                            videoURL={submission.videoURL}
                            username={submission.userDisplayName ?? getEntryName(entry)}
                            category={submission.category}
                            durationSeconds={submission.mediaDurationSeconds}
                            voteCount={
                              battle.status === 'finished'
                                ? resultBreakdown?.publicVoteCount
                                : submission.voteCount
                            }
                            size="compact"
                          />
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-surface-950/40 px-4 py-5 text-sm text-surface-500">
                          <Headphones className="h-4 w-4" />
                          Assobio ainda nao enviado.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <PixPayment
              title={battle.title}
              amount={battle.entryFee}
              paymentId={payment.paymentId}
              pixQrCode={payment.pixQrCode}
              pixCopiaECola={payment.pixCopiaECola}
              expiresAt={payment.expiresAt}
              getAuthToken={getToken}
              primaryHref={`/batalhas/${battle.id}`}
              primaryLabel="Voltar para batalha"
              secondaryHref={`/batalhas/${battle.id}`}
              secondaryLabel="Fechar"
              allowTestApproval={process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'}
              onApproved={() => setPayment(null)}
            />
            <button
              type="button"
              onClick={() => setPayment(null)}
              className="mt-3 w-full text-center text-sm text-surface-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <SubmitBattleAudioModal
        open={submitOpen}
        battleId={battle.id}
        battleTitle={battle.title}
        category={battle.category}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={() => setSubmitOpen(false)}
      />

      {pendingVote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Confirmar voto</h2>
                <p className="mt-1 text-sm text-surface-500">
                  Essa acao nao pode ser desfeita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingVote(null)}
                className="rounded-lg p-1 text-surface-500 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-surface-300">
                Voce esta votando em{' '}
                <span className="font-semibold text-white">
                  {pendingVote.userDisplayName ?? pendingVote.userId}
                </span>
                . Confirme apenas se esse e o assobio que voce quer escolher nesta batalha.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingVote(null)}
                disabled={votingId === pendingVote.id}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => handleVote(pendingVote.id)}
                loading={votingId === pendingVote.id}
              >
                Confirmar voto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
