'use client';

import { useMemo, useState } from 'react';
import {
  useAuth,
  useCollection,
  where,
  limit,
} from '@batalha/firebase';
import { Badge, Button, Card, CardContent, Skeleton } from '@batalha/ui';
import { formatDate, formatNumber, toDate } from '@batalha/utils';
import { toast } from 'sonner';
import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type BrazilState,
  type CompetitionCategory,
  type QualifierMatch,
  type QualifierRegistration,
  type QualifierTrack,
} from '@batalha/types';
import { getWebApiBaseUrl } from '../../lib/web-api';

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-surface-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-12 w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white transition-all duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const BRAZIL_STATE_OPTIONS = Object.entries(BRAZIL_STATE_LABELS).map(([value, label]) => ({
  value,
  label: `${value} - ${label}`,
}));

const TRACK_STATUS_CONFIG: Record<
  QualifierTrack['status'],
  { label: string; variant: 'success' | 'warning' | 'info' | 'default' }
> = {
  registration_open: { label: 'Inscrições abertas', variant: 'success' },
  draw_pending: { label: 'Sorteio pendente', variant: 'warning' },
  active: { label: 'Em andamento', variant: 'info' },
  finished: { label: 'Finalizada', variant: 'default' },
};

function AdminQualifierActions() {
  const { user } = useAuth();
  const [region, setRegion] = useState<BrazilState>('SP');
  const [category, setCategory] = useState<CompetitionCategory>('freestyle');
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const callQualifierApi = async (
    path:
      | '/api/admin/qualifiers/generate'
      | '/api/admin/qualifiers/finalize-round'
      | '/api/admin/qualifiers/advance-round',
  ) => {
    if (!user) {
      throw new Error('Entre como admin para gerenciar Classificatórias.');
    }

    const token = await user.getIdToken();
    const baseURL = getWebApiBaseUrl();
    const response = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ region, category }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao atualizar Classificatória');
    }

    return data;
  };

  const finalizeRound = async () => {
    if (
      !confirm(
        `Finalizar rodada atual da Classificatória ${region} ${COMPETITION_CATEGORY_LABELS[category]}?`,
      )
    ) {
      return;
    }

    setFinalizing(true);
    try {
      const data = await callQualifierApi('/api/admin/qualifiers/finalize-round');
      toast.success(
        data.finalizedCount > 0
          ? `Rodada finalizada: ${data.finalizedCount} confronto(s).`
          : 'Nenhum confronto em votação para finalizar.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao finalizar rodada');
    } finally {
      setFinalizing(false);
    }
  };

  const generateBracket = async () => {
    if (
      !confirm(`Gerar chave da Classificatória ${region} ${COMPETITION_CATEGORY_LABELS[category]}?`)
    ) {
      return;
    }

    setLoading(true);
    try {
      const data = await callQualifierApi('/api/admin/qualifiers/generate');
      toast.success(
        data.matchCount > 0
          ? `Chave gerada: ${data.matchCount} partida(s), ${data.byeCount} bye(s), ${data.plannedMatchDays} dia(s).`
          : `Classificatória encerrada: ${data.byeCount} participante(s) classificados.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar chave');
    } finally {
      setLoading(false);
    }
  };

  const advanceRound = async () => {
    if (
      !confirm(
        `Avançar rodada da Classificatória ${region} ${COMPETITION_CATEGORY_LABELS[category]}?`,
      )
    ) {
      return;
    }

    setAdvancing(true);
    try {
      const data = await callQualifierApi('/api/admin/qualifiers/advance-round');
      toast.success(
        data.status === 'finished'
          ? `Classificatória encerrada: ${data.qualifiedCount} classificado(s).`
          : `Rodada ${data.roundNumber} criada: ${data.matchCount} partida(s), ${data.byeCount} bye(s).`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao avançar rodada');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Badge variant="gold">Classificatórias</Badge>
            <h2 className="mt-3 text-lg font-bold text-white">Operação da chave</h2>
            <p className="mt-1 max-w-2xl text-sm text-surface-400">
              Classificatórias são o fluxo oficial de entrada para Regionais. Elas não são
              Batalhas e não são gerenciadas dentro de Campeonatos.
            </p>
          </div>

          <div className="grid w-full gap-4 lg:max-w-3xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Estado"
                value={region}
                onChange={(value) => setRegion(value as BrazilState)}
                options={BRAZIL_STATE_OPTIONS}
              />
              <SelectField
                label="Categoria"
                value={category}
                onChange={(value) => setCategory(value as CompetitionCategory)}
                options={COMPETITION_CATEGORIES.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Button onClick={generateBracket} loading={loading} className="w-full">
                Gerar chave
              </Button>
              <Button
                variant="secondary"
                onClick={finalizeRound}
                loading={finalizing}
                className="w-full"
              >
                Finalizar rodada
              </Button>
              <Button
                variant="secondary"
                onClick={advanceRound}
                loading={advancing}
                className="w-full"
              >
                Avançar rodada
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminQualifiersPage() {
  const { data: tracks, loading: tracksLoading } = useCollection<QualifierTrack>(
    'qualifierTracks',
    [],
  );
  const { data: registrations } = useCollection<QualifierRegistration>(
    'qualifierRegistrations',
    [where('status', '==', 'confirmed'), limit(1000)],
  );
  const { data: matches } = useCollection<QualifierMatch>('qualifierMatches', [limit(1000)]);

  const trackStats = useMemo(() => {
    const registrationsByTrack = new Map<string, number>();
    registrations.forEach((registration) => {
      const key = `${registration.region}-${registration.category}`;
      registrationsByTrack.set(key, (registrationsByTrack.get(key) ?? 0) + 1);
    });

    const matchesByTrack = new Map<string, { total: number; open: number; voting: number }>();
    matches.forEach((match) => {
      const key = `${match.region}-${match.category}`;
      const current = matchesByTrack.get(key) ?? { total: 0, open: 0, voting: 0 };
      current.total += 1;
      if (match.status === 'submissions_open') current.open += 1;
      if (match.status === 'voting') current.voting += 1;
      matchesByTrack.set(key, current);
    });

    return { registrationsByTrack, matchesByTrack };
  }, [matches, registrations]);
  const sortedTracks = useMemo(
    () =>
      [...tracks].sort((a, b) => {
        if (a.region !== b.region) return a.region.localeCompare(b.region);
        return a.category.localeCompare(b.category);
      }),
    [tracks],
  );
  const publicBaseURL = getWebApiBaseUrl();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Classificatórias</h1>
        <p className="mt-1 text-surface-400">
          Gerencie inscrições, sorteios e rodadas das Classificatórias oficiais.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <AdminQualifierActions />

        {tracksLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)
        ) : sortedTracks.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center text-sm text-surface-500">
                Nenhuma Classificatória encontrada.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedTracks.map((track) => {
            const cfg = TRACK_STATUS_CONFIG[track.status] ?? TRACK_STATUS_CONFIG.registration_open;
            const key = `${track.region}-${track.category}`;
            const confirmedCount =
              trackStats.registrationsByTrack.get(key) ?? track.confirmedCount ?? 0;
            const matchStats = trackStats.matchesByTrack.get(key) ?? {
              total: 0,
              open: 0,
              voting: 0,
            };
            const registrationDeadline = toDate(track.registrationDeadline);
            const bracketStart = toDate(track.bracketStart);
            const bracketEnd = toDate(track.bracketEnd);

            return (
              <Card key={track.id}>
                <CardContent>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <Badge variant="default">{track.region}</Badge>
                        <Badge variant="default">
                          {COMPETITION_CATEGORY_LABELS[track.category]}
                        </Badge>
                        <Badge variant="default">Temporada {track.seasonYear}</Badge>
                      </div>

                      <h3 className="mt-3 font-semibold text-white">
                        Classificatória {BRAZIL_STATE_LABELS[track.region]}{' '}
                        {COMPETITION_CATEGORY_LABELS[track.category]}
                      </h3>
                      <p className="mt-1 text-sm text-surface-500">
                        Inscrições até{' '}
                        {registrationDeadline ? formatDate(registrationDeadline) : 'A definir'}
                        {bracketStart && bracketEnd
                          ? ` · Chave: ${formatDate(bracketStart)} — ${formatDate(bracketEnd)}`
                          : ''}
                      </p>
                    </div>

                    <a
                      href={`${publicBaseURL}/classificatorias/${track.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-sm font-semibold text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white"
                    >
                      Ver pública
                    </a>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-lg font-bold text-white">
                        {formatNumber(confirmedCount)}
                      </p>
                      <p className="mt-1 text-xs text-surface-500">confirmados</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-lg font-bold text-white">{matchStats.total}</p>
                      <p className="mt-1 text-xs text-surface-500">partidas</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-lg font-bold text-white">{matchStats.open}</p>
                      <p className="mt-1 text-xs text-surface-500">envios abertos</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-lg font-bold text-white">{matchStats.voting}</p>
                      <p className="mt-1 text-xs text-surface-500">em votação</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
