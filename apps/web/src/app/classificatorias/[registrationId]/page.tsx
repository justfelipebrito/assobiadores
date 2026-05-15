'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Mic,
  Trophy,
  Users,
  Vote,
} from 'lucide-react';
import { limit, useAuth, useCollection, useDocument, where } from '@batalha/firebase';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORY_LABELS,
  type Championship,
  type QualifierMatch,
  type QualifierRegistration,
  type QualifierSubmission,
  type QualifierTrack,
} from '@batalha/types';
import { Badge, Button, Card, CardContent } from '@batalha/ui';
import { formatNumber } from '@batalha/utils';
import { toast } from 'sonner';
import { AudioHighlightPlayer } from '@/components/media/audio-highlight-player';
import { SubmitQualifierMatchModal } from '@/components/qualifiers/submit-qualifier-match-modal';
import {
  getQualifierEmptyMatchesCopy,
  getDisplayQualifierRound,
  getQualifierMatchHeaderDateCopy,
  getQualifierMatchResultCopy,
  getQualifierMatchStatusCopy,
  getQualifierRegistrationStateCopy,
  getQualifierRuleCards,
  sortQualifierMatches,
} from '@/lib/qualifier-view';
import {
  getQualifierTrackId,
  getQualifierTrackTitle,
  parseQualifierTrackSlug,
  QUALIFIER_BRACKET_END_LABEL,
  QUALIFIER_BRACKET_START_LABEL,
  QUALIFIER_SEASON_ID,
  QUALIFIER_SUBMISSION_DEADLINE_LABEL,
  QUALIFIER_VOTING_WINDOW_LABEL,
} from '@/lib/qualifier-tracks';

const QUALIFIER_SEASON_LABEL = 'Temporada 2026';
const QUALIFIER_DATE_RANGE = `${QUALIFIER_BRACKET_START_LABEL} - ${QUALIFIER_BRACKET_END_LABEL}`;

interface QualifierParticipant {
  id: string;
  userId: string;
  seasonId: string;
  seasonYear: number;
  category: keyof typeof COMPETITION_CATEGORY_LABELS;
  region: keyof typeof BRAZIL_STATE_LABELS;
  displayName: string;
  rank: string;
  points: number;
  confirmedAt?: unknown;
}

function formatDateTime(value: unknown) {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  if (!date && typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate: () => Date }).toDate();
  }
  if (!date && typeof value === 'object' && value !== null && 'seconds' in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }
  if (!date) return 'A definir';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function getTime(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function QualifierBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/classificatorias');
      }}
      className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
}

export default function QualifierRegistrationPage() {
  const params = useParams<{ registrationId: string }>();
  const registrationId = params.registrationId;
  const publicTrackSlug = parseQualifierTrackSlug(registrationId);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [submissionMatch, setSubmissionMatch] = useState<QualifierMatch | null>(null);
  const [votingSubmissionId, setVotingSubmissionId] = useState<string | null>(null);
  const [votedMatchIds, setVotedMatchIds] = useState<Set<string>>(new Set());
  const publicTrackId = publicTrackSlug
    ? getQualifierTrackId(publicTrackSlug.region, publicTrackSlug.category)
    : undefined;
  const regionalChampionshipId = publicTrackSlug
    ? `championship-${publicTrackSlug.region.toLowerCase()}-2026-${publicTrackSlug.category}`
    : undefined;
  const { user, loading: authLoading } = useAuth();
  const { data: publicTrack, loading: publicTrackLoading } = useDocument<QualifierTrack>(
    'qualifierTracks',
    publicTrackId,
  );
  const { data: regionalChampionship } = useDocument<Championship>(
    'championships',
    regionalChampionshipId,
  );
  const { data: registration, loading: registrationLoading } = useDocument<QualifierRegistration>(
    'qualifierRegistrations',
    user && !publicTrackSlug ? registrationId : undefined,
  );
  const { data: matches, loading: matchesLoading } = useCollection<QualifierMatch>(
    'qualifierMatches',
    publicTrackSlug
      ? [
          where('seasonId', '==', QUALIFIER_SEASON_ID),
          where('region', '==', publicTrackSlug.region),
          where('category', '==', publicTrackSlug.category),
          limit(1000),
        ]
      : [where('registrationIds', 'array-contains', registrationId), limit(20)],
  );
  const { data: trackParticipants, loading: trackParticipantsLoading } =
    useCollection<QualifierParticipant>(
      publicTrackSlug ? 'qualifierParticipants' : undefined,
      publicTrackSlug
        ? [
            where('seasonId', '==', QUALIFIER_SEASON_ID),
            where('region', '==', publicTrackSlug.region),
            where('category', '==', publicTrackSlug.category),
            limit(1000),
          ]
        : [],
    );
  const { data: qualifierSubmissions } = useCollection<QualifierSubmission>(
    publicTrackSlug ? 'qualifierSubmissions' : undefined,
    publicTrackSlug
      ? [
          where('seasonId', '==', QUALIFIER_SEASON_ID),
          where('region', '==', publicTrackSlug.region),
          where('category', '==', publicTrackSlug.category),
          limit(1000),
        ]
      : [],
  );

  const sortedMatches = useMemo(() => sortQualifierMatches(matches), [matches]);
  const participantByUserId = useMemo(
    () => new Map(trackParticipants.map((participant) => [participant.userId, participant])),
    [trackParticipants],
  );
  const regionalParticipantIds = useMemo(
    () => new Set(regionalChampionship?.participantIds ?? []),
    [regionalChampionship],
  );
  const confirmedParticipants = useMemo(() => {
    return [...trackParticipants].sort((a, b) => {
      const aConfirmedAt = getTime(a.confirmedAt);
      const bConfirmedAt = getTime(b.confirmedAt);
      if (aConfirmedAt !== bConfirmedAt) return aConfirmedAt - bConfirmedAt;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [trackParticipants]);
  const publicRoundNumbers = useMemo(() => {
    return Array.from(new Set(sortedMatches.map((match) => match.roundNumber))).sort(
      (a, b) => a - b,
    );
  }, [sortedMatches]);
  const displayRound = getDisplayQualifierRound(publicRoundNumbers, selectedRound);
  const publicRoundMatches = sortedMatches.filter((match) => match.roundNumber === displayRound);
  const submissionByMatchAndUserId = useMemo(() => {
    const grouped = new Map<string, Map<string, QualifierSubmission>>();
    qualifierSubmissions.forEach((submission) => {
      if (submission.roundNumber !== displayRound) return;
      const current = grouped.get(submission.matchId) ?? new Map<string, QualifierSubmission>();
      current.set(submission.userId, submission);
      grouped.set(submission.matchId, current);
    });
    return grouped;
  }, [displayRound, qualifierSubmissions]);
  const canGoToPreviousRound = publicRoundNumbers.some((round) => round < displayRound);
  const canGoToNextRound = publicRoundNumbers.some((round) => round > displayRound);
  const stateCopy = registration ? getQualifierRegistrationStateCopy(registration) : null;
  const isOwner = Boolean(user && registration && registration.userId === user.uid);

  async function voteOnQualifierSubmission(match: QualifierMatch, submissionId: string) {
    if (!user) {
      toast.error('Entre para votar.');
      return;
    }
    if (match.participantIds.includes(user.uid)) {
      toast.error('Participantes nao podem votar em Classificatorias.');
      return;
    }

    setVotingSubmissionId(submissionId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/qualifiers/matches/${match.id}/vote`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submissionId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Erro ao registrar voto.');
      }
      setVotedMatchIds((current) => new Set(current).add(match.id));
      toast.success('Voto registrado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar voto.');
    } finally {
      setVotingSubmissionId(null);
    }
  }

  if (publicTrackSlug) {
    if (publicTrackLoading) {
      return (
        <div className="mx-auto flex min-h-[50vh] max-w-5xl items-center justify-center px-4">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <QualifierBackButton />

        <section className="rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-yellow-300">
              Inscrições abertas
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-surface-300">
              {BRAZIL_STATE_LABELS[publicTrackSlug.region]}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {getQualifierTrackTitle(publicTrackSlug.region, publicTrackSlug.category)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-surface-400">
            Link público da classificatória. Entre na plataforma para se inscrever pela sua
            Naturalidade e acompanhar sua chave privada.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-white">{publicTrack?.confirmedCount ?? 0}</p>
              <p className="mt-1 text-sm text-surface-500">inscritos confirmados</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-white">{QUALIFIER_BRACKET_START_LABEL}</p>
              <p className="mt-1 text-sm text-surface-500">início dos confrontos</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <h2 className="font-semibold text-white">Regras</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {getQualifierRuleCards(publicTrack?.maxQualified ?? 64).map((rule) => (
              <div
                key={rule.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">
                  {rule.title}
                </p>
                <p className="mt-1 text-sm text-surface-300">{rule.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-white">Chave da Classificatória</h2>
              <p className="mt-1 text-sm text-surface-500">
                Confrontos por rodada, com limite diário de partidas para manter o evento
                acompanhável.
              </p>
            </div>
            {publicRoundNumbers.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canGoToPreviousRound}
                  onClick={() => {
                    const previous = [...publicRoundNumbers]
                      .reverse()
                      .find((round) => round < displayRound);
                    if (previous) setSelectedRound(previous);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-28 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-semibold text-white">
                  Rodada {displayRound}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canGoToNextRound}
                  onClick={() => {
                    const next = publicRoundNumbers.find((round) => round > displayRound);
                    if (next) setSelectedRound(next);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {matchesLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            </div>
          ) : publicRoundMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm text-surface-400">
                A chave aparece aqui quando a Classificatória sair da fase de inscrição.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {publicRoundMatches.map((match) => {
                const first = participantByUserId.get(match.participantIds[0] ?? '');
                const second = participantByUserId.get(match.participantIds[1] ?? '');
                const hasVoted = votedMatchIds.has(match.id);
                const userIsParticipant = Boolean(user && match.participantIds.includes(user.uid));
                const winnerParticipant = match.winnerId
                  ? participantByUserId.get(match.winnerId)
                  : null;
                const winnerName = match.winnerId
                  ? (winnerParticipant?.displayName ?? match.winnerId)
                  : null;
                const resultCopy = getQualifierMatchResultCopy({
                  winnerName,
                  qualifiedForRegional: Boolean(
                    match.winnerId && regionalParticipantIds.has(match.winnerId),
                  ),
                });

                return (
                  <div
                    key={match.id}
                    className="rounded-xl border border-white/10 bg-surface-950/30 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">Dia {match.matchDayIndex ?? 1}</Badge>
                        <Badge variant="gold">{getQualifierMatchStatusCopy(match.status)}</Badge>
                      </div>
                      <p className="text-xs text-surface-500">
                        {getQualifierMatchHeaderDateCopy(match, formatDateTime)}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem] md:items-center">
                      <div className="space-y-2">
                        {[first, second].map((participant, index) => {
                          const fallback = match.participantIds[index] ?? 'A definir';
                          const participantUserId = participant?.userId ?? fallback;
                          const submission = submissionByMatchAndUserId
                            .get(match.id)
                            ?.get(participantUserId);
                          const isWinner = Boolean(
                            match.winnerId && match.winnerId === participant?.userId,
                          );

                          return (
                            <div
                              key={fallback}
                              className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-white">
                                    {participant?.displayName ?? fallback}
                                  </p>
                                  {isWinner && (
                                    <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-300">
                                      vencedor
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 truncate text-xs text-surface-500">
                                  {participant?.rank ?? 'Participante'}
                                </p>
                                {submission && (
                                  <p className="mt-2 text-xs font-medium text-surface-500">
                                    {submission.publicVoteCount ?? 0}{' '}
                                    {(submission.publicVoteCount ?? 0) === 1 ? 'voto' : 'votos'}
                                  </p>
                                )}
                              </div>

                              {submission ? (
                                <div className="min-w-0 space-y-2">
                                  <AudioHighlightPlayer
                                    src={submission.mediaURL}
                                    username={submission.userDisplayName}
                                    category={submission.category}
                                    durationSeconds={submission.mediaDurationSeconds}
                                    size="compact"
                                    showHeader={false}
                                  />
                                  {match.status === 'voting' && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="w-full"
                                      disabled={hasVoted || userIsParticipant}
                                      loading={votingSubmissionId === submission.id}
                                      onClick={() => voteOnQualifierSubmission(match, submission.id)}
                                    >
                                      <Vote className="mr-2 h-4 w-4" />
                                      {hasVoted ? 'Voto registrado' : 'Votar'}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-white/10 bg-surface-950/40 px-4 py-5 text-sm text-surface-500">
                                  Envio ainda não recebido.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div
                        className={
                          resultCopy.tone === 'success'
                            ? 'self-center rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-center text-sm'
                            : 'self-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm'
                        }
                      >
                        <p
                          className={
                            resultCopy.tone === 'success'
                              ? 'text-xs font-semibold text-brand-300'
                              : 'text-xs text-surface-500'
                          }
                        >
                          {resultCopy.title}
                        </p>
                        <p className="mt-1 font-semibold text-white">
                          {resultCopy.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Participantes confirmados</h2>
              <p className="mt-1 text-sm text-surface-500">
                Ordenados pela data de inscrição confirmada, do primeiro ao último.
              </p>
            </div>
            <Users className="h-5 w-5 text-brand-400" />
          </div>

          {trackParticipantsLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            </div>
          ) : confirmedParticipants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm text-surface-400">
                Ainda não há participantes confirmados nesta Classificatória.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-surface-950/30">
              {confirmedParticipants.map((participant) => (
                <Link
                  key={participant.id}
                  href={`/perfil/${participant.userId}`}
                  className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_7rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {participant.displayName}
                    </p>
                    <p className="truncate text-xs text-surface-500">{participant.rank}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-white">
                      {formatNumber(participant.points)}
                    </p>
                    <p className="text-[10px] text-surface-600">pts</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (authLoading || registrationLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="text-center">
            <Trophy className="mx-auto h-8 w-8 text-brand-400" />
            <h1 className="mt-4 text-xl font-bold text-white">Entre para ver sua chave</h1>
            <p className="mt-2 text-sm text-surface-400">
              As Classificatórias ficam vinculadas ao seu perfil.
            </p>
            <Link href="/entrar" className="mt-5 inline-flex">
              <Button>Entrar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!registration || !isOwner) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <QualifierBackButton />
        <Card>
          <CardContent className="text-center">
            <Flag className="mx-auto h-8 w-8 text-surface-500" />
            <h1 className="mt-4 text-xl font-bold text-white">Inscrição não encontrada</h1>
            <p className="mt-2 text-sm text-surface-400">
              Verifique suas inscrições confirmadas na página de Classificatórias.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SubmitQualifierMatchModal
        open={Boolean(submissionMatch)}
        matchId={submissionMatch?.id ?? null}
        category={registration.category}
        deadlineLabel={
          submissionMatch ? formatDateTime(submissionMatch.submissionDeadline) : 'A definir'
        }
        onClose={() => setSubmissionMatch(null)}
        onSubmitted={() => setSubmissionMatch(null)}
      />

      <QualifierBackButton />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-brand-300">
              {COMPETITION_CATEGORY_LABELS[registration.category]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-surface-300">
              {BRAZIL_STATE_LABELS[registration.region]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-surface-300">
              {QUALIFIER_SEASON_LABEL}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white">
            Classificatória {BRAZIL_STATE_LABELS[registration.region]}{' '}
            {COMPETITION_CATEGORY_LABELS[registration.category]}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-surface-400">
            Esta é a sua jornada para disputar uma vaga no Regional. Quando o sorteio acontecer, o
            confronto aparece aqui com prazo de envio e janela de votação.
          </p>

          {stateCopy && (
            <div className="mt-5 rounded-xl border border-brand-500/20 bg-brand-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-brand-400" />
                {stateCopy.title}
              </div>
              <p className="mt-1 text-sm text-surface-300">{stateCopy.description}</p>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-white/10 bg-surface-900/70 p-5">
          <h2 className="font-semibold text-white">Prazos oficiais</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-brand-400" />
              <div>
                <p className="font-medium text-white">Período</p>
                <p className="text-surface-400">{QUALIFIER_DATE_RANGE}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mic className="mt-0.5 h-4 w-4 text-brand-400" />
              <div>
                <p className="font-medium text-white">Envio</p>
                <p className="text-surface-400">
                  Até {QUALIFIER_SUBMISSION_DEADLINE_LABEL} no dia do confronto.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-brand-400" />
              <div>
                <p className="font-medium text-white">Votação</p>
                <p className="text-surface-400">{QUALIFIER_VOTING_WINDOW_LABEL}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-white/10 bg-surface-900/70 p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Minha chave</h2>
            <p className="mt-1 text-sm text-surface-500">Confrontos randômicos 1v1 por fase.</p>
          </div>
          <Users className="h-5 w-5 text-brand-400" />
        </div>

        {matchesLoading ? (
          <div className="flex min-h-28 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          </div>
        ) : sortedMatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
            <p className="text-sm text-surface-400">{getQualifierEmptyMatchesCopy(registration)}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedMatches.map((match) => {
              const alreadySubmitted = Boolean(user && match.submissionIds?.[user.uid]);
              const canSubmit =
                Boolean(user) &&
                match.status === 'submissions_open' &&
                match.participantIds.includes(user!.uid) &&
                !alreadySubmitted;

              return (
                <div
                  key={match.id}
                  className="rounded-xl border border-white/10 bg-surface-950/30 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">
                        {match.roundLabel}
                      </p>
                      <h3 className="mt-1 font-semibold text-white">
                        {getQualifierMatchStatusCopy(match.status)}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-surface-300">
                      Rodada {match.roundNumber}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-surface-500">Data</p>
                      <p className="mt-1 font-medium text-surface-200">
                        {formatDateTime(match.scheduledFor)}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500">Envio até</p>
                      <p className="mt-1 font-medium text-surface-200">
                        {formatDateTime(match.submissionDeadline)}
                      </p>
                    </div>
                    <div>
                      <p className="text-surface-500">Votação encerra</p>
                      <p className="mt-1 font-medium text-surface-200">
                        {formatDateTime(match.votingEnd)}
                      </p>
                    </div>
                  </div>

                  {(canSubmit || alreadySubmitted) && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <p className="text-sm text-surface-300">
                        {alreadySubmitted
                          ? 'Envio recebido para este confronto.'
                          : 'Seu envio esta aberto para este confronto.'}
                      </p>
                      {canSubmit && (
                        <Button size="sm" onClick={() => setSubmissionMatch(match)}>
                          <Mic className="mr-2 h-4 w-4" />
                          Enviar assobio
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
