'use client';

import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  useCollection,
  orderBy,
  getClientFirestore,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from '@batalha/firebase';
import {
  Button,
  Badge,
  Card,
  CardContent,
  Skeleton,
  EmptyState,
  Input,
  Textarea,
} from '@batalha/ui';
import { formatDate, toDate } from '@batalha/utils';
import { toast } from 'sonner';
import {
  COMPETITION_CATEGORY_LABELS,
  type Championship,
  type Stage,
  type Match,
} from '@batalha/types';
import {
  MATCH_STATUS_OPTIONS,
  STAGE_NAME_OPTIONS,
  STAGE_STATUS_OPTIONS,
  STAGE_TYPE_OPTIONS,
  buildMatchPayload,
  buildStagePayload,
  canFinalizeChampionship,
  canFinalizeMatch,
  createDefaultMatchFormValues,
  createDefaultStageFormValues,
  getMatchStatusLabel,
  getMatchTitle,
  getStageProgress,
  type MatchFormValues,
  type StageFormValues,
} from './championship-management';

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

function MatchManager({ championshipId, stage }: { championshipId: string; stage: Stage }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<MatchFormValues>(() => createDefaultMatchFormValues());
  const { data: matches, loading } = useCollection<Match>(
    `championships/${championshipId}/stages/${stage.id}/matches`,
    [orderBy('scheduledAt', 'asc')],
  );

  const setValue = (field: keyof MatchFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const createMatch = async () => {
    setSaving(true);
    try {
      const payload = buildMatchPayload(values);
      const db = getClientFirestore();
      const matchRef = await addDoc(
        collection(db, `championships/${championshipId}/stages/${stage.id}/matches`),
        {
          ...payload,
          championshipId,
          stageId: stage.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );
      await updateDoc(matchRef, { id: matchRef.id });
      toast.success('Partida criada.');
      setValues(createDefaultMatchFormValues());
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar partida');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-white">Partidas</h4>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fechar' : 'Nova partida'}
        </Button>
      </div>

      {showForm && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              label="Status"
              value={values.status}
              onChange={(value) => setValue('status', value)}
              options={MATCH_STATUS_OPTIONS}
            />
            <Input
              label="Data e hora"
              type="datetime-local"
              value={values.scheduledAt}
              onChange={(event) => setValue('scheduledAt', event.target.value)}
            />
            <Input
              label="Battle ID vinculado"
              value={values.battleId}
              onChange={(event) => setValue('battleId', event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <Textarea
            label="Competidores"
            value={values.participantIdsText}
            onChange={(event) => setValue('participantIdsText', event.target.value)}
            helperText="IDs dos usuarios separados por virgula ou linha."
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={createMatch} loading={saving}>
              Criar partida
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <p className="text-sm text-surface-500">Nenhuma partida nesta fase.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {matches.map((match) => {
              const scheduledAt = toDate(match.scheduledAt);
              return (
                <div key={match.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {getMatchTitle(match)}
                    </p>
                    <p className="text-xs text-surface-500">
                      {scheduledAt ? formatDate(scheduledAt) : 'Sem data'}
                      {match.battleId && ` · Battle ${match.battleId}`}
                    </p>
                  </div>
                  <Badge variant={match.status === 'finished' ? 'default' : 'info'}>
                    {getMatchStatusLabel(match.status)}
                  </Badge>
                  <FinalizeMatchButton
                    championshipId={championshipId}
                    stageId={stage.id}
                    match={match}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FinalizeMatchButton({
  championshipId,
  stageId,
  match,
}: {
  championshipId: string;
  stageId: string;
  match: Match;
}) {
  const [loading, setLoading] = useState(false);

  if (!canFinalizeMatch(match)) return null;

  const finalize = async () => {
    if (!confirm('Finalizar esta partida?')) return;

    setLoading(true);
    try {
      const db = getClientFirestore();
      const functions = getFunctions(db.app, 'southamerica-east1');
      const finalizeMatch = httpsCallable(functions, 'finalizeMatch');
      const result = await finalizeMatch({ championshipId, stageId, matchId: match.id });
      const data = result.data as { winnerId: string | null };
      toast.success(
        data.winnerId
          ? `Partida finalizada. Vencedor: ${data.winnerId}`
          : 'Partida finalizada sem vencedor definido.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar partida');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={finalize} loading={loading}>
      Finalizar
    </Button>
  );
}

function FinalizeChampionshipButton({
  championship,
  stages,
}: {
  championship: Championship;
  stages: Stage[];
}) {
  const [loading, setLoading] = useState(false);

  if (!canFinalizeChampionship(championship, stages)) return null;

  const finalize = async () => {
    if (!confirm(`Finalizar "${championship.title}"?`)) return;

    setLoading(true);
    try {
      const db = getClientFirestore();
      const functions = getFunctions(db.app, 'southamerica-east1');
      const finalizeChampionship = httpsCallable(functions, 'finalizeChampionship');
      const result = await finalizeChampionship({ championshipId: championship.id });
      const data = result.data as { champion: string | null; participantCount: number };
      toast.success(
        data.champion
          ? `Campeonato finalizado. Campeao: ${data.champion}`
          : `Campeonato finalizado com ${data.participantCount} participante(s).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar campeonato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={finalize} loading={loading}>
      Finalizar campeonato
    </Button>
  );
}

function BracketStageColumn({ championshipId, stage }: { championshipId: string; stage: Stage }) {
  const { data: matches, loading } = useCollection<Match>(
    `championships/${championshipId}/stages/${stage.id}/matches`,
    [orderBy('scheduledAt', 'asc')],
  );
  const progress = getStageProgress(matches);

  return (
    <div className="min-w-[260px] rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{stage.name}</p>
          <p className="mt-1 text-xs text-surface-500">
            Ordem {stage.order} · {stage.type === 'group' ? 'Grupo' : 'Mata-mata'}
          </p>
        </div>
        <Badge variant={stage.status === 'finished' ? 'default' : 'info'}>{stage.status}</Badge>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-brand-500" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-surface-500">
          {progress.finished}/{progress.total} finalizadas
          {progress.active > 0 && ` · ${progress.active} em andamento`}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : matches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-surface-500">
            Sem partidas
          </p>
        ) : (
          matches.map((match) => {
            const scheduledAt = toDate(match.scheduledAt);
            return (
              <div
                key={match.id}
                className="rounded-xl border border-white/10 bg-surface-950/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-white">
                    {getMatchTitle(match)}
                  </p>
                  <Badge
                    variant={match.status === 'finished' ? 'default' : 'info'}
                    className="text-[10px]"
                  >
                    {getMatchStatusLabel(match.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-surface-500">
                  {scheduledAt ? formatDate(scheduledAt) : 'Sem data'}
                </p>
                {match.winnerId && (
                  <p className="mt-1 truncate text-xs text-brand-400">Vencedor: {match.winnerId}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StageManager({ championship }: { championship: Championship }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: stages, loading } = useCollection<Stage>(
    `championships/${championship.id}/stages`,
    [orderBy('order', 'asc')],
  );
  const [values, setValues] = useState<StageFormValues>(() => createDefaultStageFormValues(1));

  const setValue = (field: keyof StageFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const createStage = async () => {
    setSaving(true);
    try {
      const payload = buildStagePayload(values);
      const db = getClientFirestore();
      const stageRef = await addDoc(collection(db, `championships/${championship.id}/stages`), {
        ...payload,
        championshipId: championship.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(stageRef, { id: stageRef.id });
      toast.success('Fase criada.');
      setValues(createDefaultStageFormValues(stages.length + 2));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar fase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-sm text-brand-400 transition-colors hover:text-brand-300"
      >
        {expanded ? 'Fechar fases' : `Gerenciar fases e partidas (${stages.length})`}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 rounded-2xl border border-white/10 p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <SelectField
              label="Fase"
              value={values.name}
              onChange={(value) => setValue('name', value)}
              options={STAGE_NAME_OPTIONS}
            />
            <SelectField
              label="Tipo"
              value={values.type}
              onChange={(value) => setValue('type', value)}
              options={STAGE_TYPE_OPTIONS}
            />
            <SelectField
              label="Status"
              value={values.status}
              onChange={(value) => setValue('status', value)}
              options={STAGE_STATUS_OPTIONS}
            />
            <Input
              label="Ordem"
              type="number"
              min={0}
              value={values.order}
              onChange={(event) => setValue('order', event.target.value)}
            />
          </div>
          <Textarea
            label="Participantes da fase"
            value={values.participantIdsText}
            onChange={(event) => setValue('participantIdsText', event.target.value)}
            helperText="Opcional. IDs separados por virgula ou linha."
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={createStage} loading={saving}>
              Criar fase
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <p className="rounded-xl border border-white/10 px-4 py-6 text-center text-sm text-surface-500">
              Nenhuma fase criada ainda.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-end">
                <FinalizeChampionshipButton championship={championship} stages={stages} />
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="flex gap-4">
                  {stages.map((stage) => (
                    <BracketStageColumn
                      key={stage.id}
                      championshipId={championship.id}
                      stage={stage}
                    />
                  ))}
                </div>
              </div>

              {stages.map((stage) => (
                <div key={stage.id} className="rounded-2xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={stage.status === 'finished' ? 'default' : 'info'}>
                          {stage.status}
                        </Badge>
                        <Badge variant="default">
                          {stage.type === 'group' ? 'Grupo' : 'Mata-mata'}
                        </Badge>
                      </div>
                      <h3 className="mt-2 font-semibold text-white">{stage.name}</h3>
                      <p className="text-xs text-surface-500">
                        Ordem {stage.order} · {stage.participantIds.length} participante(s)
                      </p>
                    </div>
                  </div>
                  <MatchManager championshipId={championship.id} stage={stage} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminChampionshipsPage() {
  const { data: championships, loading } = useCollection<Championship>('championships', [
    orderBy('createdAt', 'desc'),
  ]);

  const STATUS_CONFIG = {
    upcoming: { label: 'Em breve', variant: 'default' as const },
    registration: { label: 'Inscricoes', variant: 'success' as const },
    active: { label: 'Em andamento', variant: 'info' as const },
    finished: { label: 'Encerrado', variant: 'default' as const },
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Campeonatos</h1>
        <p className="mt-1 text-surface-400">
          Gerencie campeonatos oficiais, fases e partidas.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : championships.length === 0 ? (
          <EmptyState
            title="Nenhum campeonato ainda"
            description="Campeonatos criados no Firestore aparecao aqui."
          />
        ) : (
          championships.map((champ) => {
            const cfg = STATUS_CONFIG[champ.status] ?? STATUS_CONFIG.upcoming;
            const start = toDate(champ.schedule?.start);
            const end = toDate(champ.schedule?.end);

            return (
              <Card key={champ.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <Badge variant="default">
                          {champ.scope === 'national' ? 'Nacional' : (champ.region ?? 'Regional')}
                        </Badge>
                        <Badge variant="default">
                          {COMPETITION_CATEGORY_LABELS[champ.category]}
                        </Badge>
                        {champ.seasonId && (
                          <Badge variant="default" className="text-xs">
                            Temporada vinculada
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold text-white">{champ.title}</h3>
                      {(start || end) && (
                        <p className="mt-1 text-sm text-surface-400">
                          {start && formatDate(start)}
                          {start && end && ' — '}
                          {end && formatDate(end)}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-surface-500">
                        {champ.currentParticipants}
                        {champ.maxParticipants > 0 && `/${champ.maxParticipants}`} participantes
                      </p>
                    </div>
                  </div>

                  {champ.status !== 'finished' && (
                    <StageManager championship={champ} />
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
