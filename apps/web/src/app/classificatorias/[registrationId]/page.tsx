'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Mic,
  Trophy,
  Users,
} from 'lucide-react';
import { limit, useAuth, useCollection, useDocument, where } from '@batalha/firebase';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORY_LABELS,
  type QualifierMatch,
  type QualifierRegistration,
  type QualifierTrack,
} from '@batalha/types';
import { Button, Card, CardContent } from '@batalha/ui';
import { formatNumber } from '@batalha/utils';
import {
  getQualifierEmptyMatchesCopy,
  getQualifierMatchStatusCopy,
  getQualifierRegistrationStateCopy,
  sortQualifierMatches,
} from '@/lib/qualifier-view';
import {
  getQualifierTrackId,
  getQualifierTrackTitle,
  parseQualifierTrackSlug,
  QUALIFIER_BRACKET_END_LABEL,
  QUALIFIER_BRACKET_START_LABEL,
  QUALIFIER_FINALIZATION_LABEL,
  QUALIFIER_REGISTRATION_DEADLINE_LABEL,
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

export default function QualifierRegistrationPage() {
  const params = useParams<{ registrationId: string }>();
  const registrationId = params.registrationId;
  const publicTrackSlug = parseQualifierTrackSlug(registrationId);
  const publicTrackId = publicTrackSlug
    ? getQualifierTrackId(publicTrackSlug.region, publicTrackSlug.category)
    : undefined;
  const { user, loading: authLoading } = useAuth();
  const { data: publicTrack, loading: publicTrackLoading } = useDocument<QualifierTrack>(
    'qualifierTracks',
    publicTrackId,
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
          limit(20),
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
            limit(100),
          ]
        : [],
    );

  const sortedMatches = useMemo(() => sortQualifierMatches(matches), [matches]);
  const confirmedParticipants = useMemo(() => {
    return [...trackParticipants].sort((a, b) => {
      const aConfirmedAt = getTime(a.confirmedAt);
      const bConfirmedAt = getTime(b.confirmedAt);
      if (aConfirmedAt !== bConfirmedAt) return aConfirmedAt - bConfirmedAt;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [trackParticipants]);
  const stateCopy = registration ? getQualifierRegistrationStateCopy(registration) : null;
  const isOwner = Boolean(user && registration && registration.userId === user.uid);

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
        <Link
          href="/classificatorias"
          className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Classificatórias
        </Link>

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
          <h2 className="font-semibold text-white">Como funciona</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              `Inscrições até ${QUALIFIER_REGISTRATION_DEADLINE_LABEL}.`,
              `Envios em cada fase até ${QUALIFIER_SUBMISSION_DEADLINE_LABEL}.`,
              `Votação pública das ${QUALIFIER_VOTING_WINDOW_LABEL}.`,
              `Resultado de cada confronto às ${QUALIFIER_FINALIZATION_LABEL}.`,
              `Até ${publicTrack?.maxQualified ?? 64} competidores se classificam para o Regional.`,
            ].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-surface-300">{item}</p>
              </div>
            ))}
          </div>
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
        <Link
          href="/classificatorias"
          className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Classificatórias
        </Link>
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
      <Link
        href="/classificatorias"
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Classificatórias
      </Link>

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
            {sortedMatches.map((match) => (
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
