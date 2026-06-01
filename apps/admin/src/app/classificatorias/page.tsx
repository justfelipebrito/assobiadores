'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  qualifierTrackToScheduleValues,
  validateQualifierScheduleValues,
  type AdminQualifierScheduleFormValues,
} from './qualifier-schedule-form';

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

function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold uppercase text-surface-500">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-11 w-full rounded-xl border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white transition-all duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

function getGlobalScheduleDefaults(tracks: QualifierTrack[]): AdminQualifierScheduleFormValues {
  const source = tracks[0];
  if (!source) {
    return {
      registrationDeadline: '',
      submissionStart: '',
      submissionEnd: '',
    };
  }
  return qualifierTrackToScheduleValues(source);
}

function GlobalQualifierScheduleForm({ tracks }: { tracks: QualifierTrack[] }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<AdminQualifierScheduleFormValues>(() =>
    getGlobalScheduleDefaults(tracks),
  );

  useEffect(() => {
    setValues(getGlobalScheduleDefaults(tracks));
  }, [tracks]);

  const setValue = (key: keyof AdminQualifierScheduleFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const saveSchedule = async () => {
    if (!user) {
      toast.error('Entre como admin para gerenciar Classificatórias.');
      return;
    }

    const validation = validateQualifierScheduleValues({ values });
    if (!validation.payload) {
      toast.error(validation.error ?? 'Revise as datas da Classificatória.');
      return;
    }

    if (
      !confirm(
        `Aplicar estas datas em todas as ${tracks.length} Classificatórias? Confrontos ainda editáveis serão reagendados.`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${getWebApiBaseUrl()}/api/admin/qualifiers/schedule`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(validation.payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar datas da Classificatória');
      }

      toast.success(
        `Datas aplicadas em ${data.trackCount ?? tracks.length} Classificatória(s). ${data.rescheduledMatchCount ?? 0} confronto(s) reagendado(s).`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar datas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Badge variant="info">Calendário global</Badge>
            <h2 className="mt-3 text-lg font-bold text-white">Datas das Classificatórias</h2>
            <p className="mt-1 max-w-2xl text-sm text-surface-400">
              Use um único calendário para todas as Classificatórias que alimentam os Regionais.
              A mudança atualiza todos os estados e categorias da temporada.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-surface-300">
            <span className="font-semibold text-white">{formatNumber(tracks.length)}</span>{' '}
            Classificatórias afetadas
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <DateTimeField
          id="qualifiers-global-registration-deadline"
          label="Fim das inscrições"
          value={values.registrationDeadline}
          onChange={(value) => setValue('registrationDeadline', value)}
        />
        <DateTimeField
          id="qualifiers-global-submission-start"
          label="Início dos envios"
          value={values.submissionStart}
          onChange={(value) => setValue('submissionStart', value)}
        />
        <DateTimeField
          id="qualifiers-global-submission-end"
          label="Fim dos envios"
          value={values.submissionEnd}
          onChange={(value) => setValue('submissionEnd', value)}
        />
        <Button onClick={saveSchedule} loading={saving} className="w-full">
          Aplicar em todas
        </Button>
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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

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
  const totals = useMemo(
    () =>
      sortedTracks.reduce(
        (acc, track) => {
          const key = `${track.region}-${track.category}`;
          const matchStats = trackStats.matchesByTrack.get(key);
          acc.confirmed += trackStats.registrationsByTrack.get(key) ?? track.confirmedCount ?? 0;
          acc.matches += matchStats?.total ?? 0;
          acc.open += matchStats?.open ?? 0;
          acc.voting += matchStats?.voting ?? 0;
          return acc;
        },
        { confirmed: 0, matches: 0, open: 0, voting: 0 },
      ),
    [sortedTracks, trackStats],
  );
  const selectedTrack = selectedTrackId
    ? sortedTracks.find((track) => track.id === selectedTrackId) ?? null
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Classificatórias</h1>
        <p className="mt-1 text-surface-400">
          Gerencie inscrições, sorteios e rodadas das Classificatórias oficiais.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {!tracksLoading && sortedTracks.length > 0 ? (
          <GlobalQualifierScheduleForm tracks={sortedTracks} />
        ) : null}

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
          <Card>
            <CardContent>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Badge variant="default">Visão geral</Badge>
                  <h2 className="mt-3 text-lg font-bold text-white">Classificatórias ativas</h2>
                  <p className="mt-1 text-sm text-surface-400">
                    Acompanhe estados, categorias, inscrições e operação sem editar cada calendário
                    individualmente.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                  <Metric label="confirmados" value={totals.confirmed} />
                  <Metric label="partidas" value={totals.matches} />
                  <Metric label="envios abertos" value={totals.open} />
                  <Metric label="em votação" value={totals.voting} />
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase text-surface-500 lg:grid">
                  <span>Classificatória</span>
                  <span>Status</span>
                  <span>Calendário</span>
                  <span>Confirmados</span>
                  <span>Partidas</span>
                  <span>Votação</span>
                  <span />
                </div>

                <div className="divide-y divide-white/10">
                  {sortedTracks.map((track) => {
                    const cfg =
                      TRACK_STATUS_CONFIG[track.status] ?? TRACK_STATUS_CONFIG.registration_open;
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
                      <div
                        key={track.id}
                        className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {BRAZIL_STATE_LABELS[track.region]}
                          </p>
                          <p className="mt-1 text-xs text-surface-500">
                            {track.region} · {COMPETITION_CATEGORY_LABELS[track.category]}
                          </p>
                        </div>
                        <div>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                        <div className="text-xs text-surface-400">
                          <p>
                            Inscrições:{' '}
                            {registrationDeadline ? formatDate(registrationDeadline) : 'A definir'}
                          </p>
                          <p className="mt-1">
                            Envios:{' '}
                            {bracketStart && bracketEnd
                              ? `${formatDate(bracketStart)} - ${formatDate(bracketEnd)}`
                              : 'A definir'}
                          </p>
                        </div>
                        <CompactStat label="Confirmados" value={confirmedCount} />
                        <CompactStat label="Partidas" value={matchStats.total} />
                        <CompactStat label="Em votação" value={matchStats.voting} />
                        <button
                          type="button"
                          onClick={() => setSelectedTrackId(track.id)}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-sm font-semibold text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white"
                        >
                          Gerenciar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTrack ? (
        <QualifierTrackModal
          track={selectedTrack}
          matches={matches.filter(
            (match) => match.region === selectedTrack.region && match.category === selectedTrack.category,
          )}
          registrations={registrations.filter(
            (registration) =>
              registration.region === selectedTrack.region &&
              registration.category === selectedTrack.category &&
              registration.status === 'confirmed',
          )}
          onClose={() => setSelectedTrackId(null)}
        />
      ) : null}
    </main>
  );
}

function QualifierTrackModal({
  track,
  matches,
  registrations,
  onClose,
}: {
  track: QualifierTrack;
  matches: QualifierMatch[];
  registrations: QualifierRegistration[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const cfg = TRACK_STATUS_CONFIG[track.status] ?? TRACK_STATUS_CONFIG.registration_open;
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return (a.matchDayIndex ?? 0) - (b.matchDayIndex ?? 0);
  });
  const matchStats = matches.reduce(
    (acc, match) => {
      acc.total += 1;
      if (match.status === 'scheduled') acc.scheduled += 1;
      if (match.status === 'submissions_open') acc.open += 1;
      if (match.status === 'voting') acc.voting += 1;
      if (match.status === 'finished' || match.status === 'walkover') acc.finished += 1;
      return acc;
    },
    { total: 0, scheduled: 0, open: 0, voting: 0, finished: 0 },
  );

  const callQualifierApi = async (
    path:
      | '/api/admin/qualifiers/generate'
      | '/api/admin/qualifiers/finalize-round'
      | '/api/admin/qualifiers/advance-round',
  ) => {
    if (!user) throw new Error('Entre como admin para gerenciar Classificatórias.');

    const token = await user.getIdToken();
    const response = await fetch(`${getWebApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ region: track.region, category: track.category }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao atualizar Classificatória');
    return data;
  };

  const runAction = async ({
    action,
    setLoading,
    confirmText,
    success,
  }: {
    action:
      | '/api/admin/qualifiers/generate'
      | '/api/admin/qualifiers/finalize-round'
      | '/api/admin/qualifiers/advance-round';
    setLoading: (value: boolean) => void;
    confirmText: string;
    success: (data: Record<string, unknown>) => string;
  }) => {
    if (!confirm(confirmText)) return;

    setLoading(true);
    try {
      const data = await callQualifierApi(action);
      toast.success(success(data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar Classificatória');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-surface-950 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
              <Badge variant="default">{track.region}</Badge>
              <Badge variant="default">{COMPETITION_CATEGORY_LABELS[track.category]}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-bold text-white">
              Classificatória {BRAZIL_STATE_LABELS[track.region]}{' '}
              {COMPETITION_CATEGORY_LABELS[track.category]}
            </h2>
            <p className="mt-1 text-sm text-surface-400">
              Operação específica da chave, participantes e confrontos desta Classificatória.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-sm font-semibold text-surface-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="confirmados" value={registrations.length || track.confirmedCount || 0} />
            <Metric label="partidas" value={matchStats.total} />
            <Metric label="agendadas" value={matchStats.scheduled} />
            <Metric label="em votação" value={matchStats.voting} />
            <Metric label="finalizadas" value={matchStats.finished} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold text-white">Calendário</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <ScheduleRow label="Fim das inscrições" value={track.registrationDeadline} />
                <ScheduleRow label="Início dos envios" value={track.bracketStart} />
                <ScheduleRow label="Fim dos envios" value={track.bracketEnd} />
              </dl>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold text-white">Operações</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Button
                  onClick={() =>
                    runAction({
                      action: '/api/admin/qualifiers/generate',
                      setLoading: setGenerating,
                      confirmText: `Gerar chave da Classificatória ${track.region} ${COMPETITION_CATEGORY_LABELS[track.category]}?`,
                      success: (data) =>
                        Number(data.matchCount ?? 0) > 0
                          ? `Chave gerada: ${data.matchCount} partida(s).`
                          : `Classificatória encerrada: ${data.byeCount ?? 0} classificado(s).`,
                    })
                  }
                  loading={generating}
                  className="w-full"
                >
                  Gerar chave
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    runAction({
                      action: '/api/admin/qualifiers/finalize-round',
                      setLoading: setFinalizing,
                      confirmText: `Finalizar rodada atual da Classificatória ${track.region} ${COMPETITION_CATEGORY_LABELS[track.category]}?`,
                      success: (data) =>
                        Number(data.finalizedCount ?? 0) > 0
                          ? `Rodada finalizada: ${data.finalizedCount} confronto(s).`
                          : 'Nenhum confronto em votação para finalizar.',
                    })
                  }
                  loading={finalizing}
                  className="w-full"
                >
                  Finalizar rodada
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    runAction({
                      action: '/api/admin/qualifiers/advance-round',
                      setLoading: setAdvancing,
                      confirmText: `Avançar rodada da Classificatória ${track.region} ${COMPETITION_CATEGORY_LABELS[track.category]}?`,
                      success: (data) =>
                        data.status === 'finished'
                          ? `Classificatória encerrada: ${data.qualifiedCount ?? 0} classificado(s).`
                          : `Rodada ${data.roundNumber ?? '-'} criada: ${data.matchCount ?? 0} partida(s).`,
                    })
                  }
                  loading={advancing}
                  className="w-full"
                >
                  Avançar rodada
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10">
            <div className="border-b border-white/10 px-4 py-3">
              <h3 className="font-semibold text-white">Confrontos</h3>
            </div>
            {sortedMatches.length === 0 ? (
              <p className="px-4 py-6 text-sm text-surface-500">Nenhum confronto gerado ainda.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {sortedMatches.slice(0, 12).map((match) => (
                  <div
                    key={match.id}
                    className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[1fr_1fr_1fr_1fr]"
                  >
                    <p className="font-semibold text-white">{match.roundLabel}</p>
                    <p className="text-surface-400">Dia {match.matchDayIndex ?? '-'}</p>
                    <p className="text-surface-400">{getMatchStatusCopy(match.status)}</p>
                    <p className="text-surface-500">
                      {Object.values(match.publicVoteCounts ?? {}).reduce(
                        (total, count) => total + Number(count ?? 0),
                        0,
                      )}{' '}
                      voto(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({ label, value }: { label: string; value: unknown }) {
  const date = toDate(value);
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-surface-500">{label}</dt>
      <dd className="font-semibold text-white">{date ? formatDate(date) : 'A definir'}</dd>
    </div>
  );
}

function getMatchStatusCopy(status: QualifierMatch['status']) {
  switch (status) {
    case 'scheduled':
      return 'Agendada';
    case 'submissions_open':
      return 'Envios abertos';
    case 'voting':
      return 'Em votação';
    case 'finished':
      return 'Finalizada';
    case 'walkover':
      return 'W.O.';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Agendada';
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-lg font-bold text-white">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-surface-500">{label}</p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-surface-500 lg:hidden">{label}</p>
      <p className="font-semibold text-white">{formatNumber(value)}</p>
    </div>
  );
}
