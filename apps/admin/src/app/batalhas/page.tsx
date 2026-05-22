'use client';

import { type FormEvent, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  orderBy,
  serverTimestamp,
  updateDoc,
  useAuth,
  useCollection,
  getClientAuth,
} from '@batalha/firebase';
import { getClientFirestore } from '@batalha/firebase';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
  Textarea,
} from '@batalha/ui';
import { formatCurrency, formatRelativeTime, toDate } from '@batalha/utils';
import { toast } from 'sonner';
import type { Battle, BattleEntry, Submission, Vote } from '@batalha/types';
import { SortableTableHeader } from '../../components/sortable-table-header';
import { getNextSortState, sortRows, type SortState } from '../../components/sortable-table';
import { getWebApiBaseUrl } from '../../lib/web-api';
import {
  ADMIN_BATTLE_CATEGORY_OPTIONS,
  ADMIN_BATTLE_FORMAT_OPTIONS,
  ADMIN_BATTLE_STATUS_OPTIONS,
  ADMIN_BATTLE_TYPE_OPTIONS,
  battleToAdminFormValues,
  createDefaultAdminBattleFormValues,
  type AdminBattleFormValues,
  validateAdminBattleForm,
} from './admin-battle-form';
import { getAdminBattleTieBreakOptions } from './admin-battle-tiebreak';

type BattleSortKey = 'battle' | 'status' | 'participants' | 'entryFee';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'default' },
  registration: { label: 'Inscricoes', color: 'success' },
  active: { label: 'Em andamento', color: 'info' },
  voting: { label: 'Em votacao', color: 'purple' },
  finished: { label: 'Finalizada', color: 'default' },
};

const BATTLE_SORT_SELECTORS = {
  battle: (battle: Battle) => battle.title,
  status: (battle: Battle) => STATUS_MAP[battle.status]?.label ?? battle.status,
  participants: (battle: Battle) => battle.currentParticipants ?? 0,
  entryFee: (battle: Battle) => battle.entryFee ?? 0,
};

interface BattleFormProps {
  battle: Battle | null;
  onCancel: () => void;
  onSaved: () => void;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
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
        className="flex h-12 w-full rounded-xl border border-white/10 bg-surface-900 px-4 py-3 text-sm text-white transition-all duration-200 focus:border-brand-500/50 focus:bg-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

function BattleForm({ battle, onCancel, onSaved }: BattleFormProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<AdminBattleFormValues>(() =>
    battle ? battleToAdminFormValues(battle) : createDefaultAdminBattleFormValues(),
  );
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(battle);

  const setValue = (field: keyof AdminBattleFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = validateAdminBattleForm(values);
    if (!result.payload) {
      toast.error(result.error ?? 'Revise os campos da batalha.');
      return;
    }

    setSaving(true);
    try {
      const db = getClientFirestore();
      const now = serverTimestamp();

      if (battle) {
        await updateDoc(doc(db, 'battles', battle.id), {
          ...result.payload,
          currentParticipants: Math.min(
            battle.currentParticipants ?? 0,
            result.payload.maxParticipants,
          ),
          updatedAt: now,
        });
        toast.success('Batalha atualizada.');
      } else {
        const battleRef = await addDoc(collection(db, 'battles'), {
          ...result.payload,
          prizePool: result.payload.prizePool ?? 0,
          prizeDistribution:
            result.payload.entryFee > 0 ? { first: 0, second: 0, third: 0 } : null,
          currentParticipants: 0,
          winners: [],
          votingType: 'public',
          judges: user?.uid ? [user.uid] : [],
          createdBy: user?.uid ?? 'admin',
          createdAt: now,
          updatedAt: now,
        });
        await updateDoc(battleRef, { id: battleRef.id });
        toast.success('Batalha criada.');
      }

      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar batalha';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-8">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? 'Editar batalha' : 'Nova batalha'}
              </h2>
              <p className="mt-1 text-sm text-surface-400">
                Configure tipo, fases e regras antes de abrir inscricoes.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Titulo"
              value={values.title}
              onChange={(event) => setValue('title', event.target.value)}
              maxLength={200}
              required
            />
            <SelectField
              label="Tipo"
              value={values.type}
              onChange={(value) => setValue('type', value)}
              options={ADMIN_BATTLE_TYPE_OPTIONS}
            />
            <SelectField
              label="Formato"
              value={values.format}
              onChange={(value) => setValue('format', value)}
              options={ADMIN_BATTLE_FORMAT_OPTIONS}
            />
            <SelectField
              label="Categoria"
              value={values.category}
              onChange={(value) => setValue('category', value)}
              options={ADMIN_BATTLE_CATEGORY_OPTIONS}
            />
            <SelectField
              label="Status"
              value={values.status}
              onChange={(value) => setValue('status', value)}
              options={ADMIN_BATTLE_STATUS_OPTIONS}
            />
            <Input
              label="Maximo de participantes"
              type="number"
              min={2}
              value={values.format === 'duel' ? '2' : values.maxParticipants}
              disabled={values.format === 'duel'}
              onChange={(event) => setValue('maxParticipants', event.target.value)}
            />
            <Input
              label="Inscricao (centavos)"
              type="number"
              min={0}
              value={values.entryFee}
              onChange={(event) => setValue('entryFee', event.target.value)}
            />
            <Input
              label="Premio total (centavos)"
              type="number"
              min={0}
              value={values.prizePool}
              disabled={Number(values.entryFee) > 0}
              onChange={(event) => setValue('prizePool', event.target.value)}
              helperText={
                Number(values.entryFee) > 0
                  ? 'Premio de batalha paga e calculado pelos pagamentos confirmados.'
                  : 'Use apenas para batalhas gratuitas com premio manual.'
              }
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-surface-300">
            Votacao: comunidade decide o resultado. Criador ou admin desempata somente apos o fim
            da votacao. Participantes nao votam na propria batalha.
          </div>

          <Textarea
            label="Descricao"
            value={values.description}
            onChange={(event) => setValue('description', event.target.value)}
            maxLength={2000}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Inicio inscricoes"
              type="datetime-local"
              value={values.registrationStart}
              onChange={(event) => setValue('registrationStart', event.target.value)}
              required
            />
            <Input
              label="Fim inscricoes"
              type="datetime-local"
              value={values.registrationEnd}
              onChange={(event) => setValue('registrationEnd', event.target.value)}
              required
            />
            <Input
              label="Prazo de envio"
              type="datetime-local"
              value={values.submissionDeadline}
              onChange={(event) => setValue('submissionDeadline', event.target.value)}
              required
            />
            <Input
              label="Inicio votacao"
              type="datetime-local"
              value={values.votingStart}
              onChange={(event) => setValue('votingStart', event.target.value)}
              required
            />
            <Input
              label="Fim votacao"
              type="datetime-local"
              value={values.votingEnd}
              onChange={(event) => setValue('votingEnd', event.target.value)}
              required
            />
          </div>

          <Textarea
            label="Regras"
            value={values.rulesText}
            onChange={(event) => setValue('rulesText', event.target.value)}
            helperText="Uma regra por linha."
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {isEditing ? 'Salvar alteracoes' : 'Criar batalha'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminBattlesPage() {
  const [editingBattle, setEditingBattle] = useState<Battle | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [tieBreakingKey, setTieBreakingKey] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<BattleSortKey>>({
    key: 'battle',
    direction: 'asc',
  });
  const { data: battles, loading } = useCollection<Battle>('battles', [
    orderBy('createdAt', 'desc'),
  ]);
  const { data: entries } = useCollection<BattleEntry>('battleEntries');
  const { data: submissions } = useCollection<Submission>('submissions');
  const { data: votes } = useCollection<Vote>('votes');
  const sortedBattles = useMemo(
    () => sortRows(battles, sort, BATTLE_SORT_SELECTORS),
    [battles, sort],
  );
  const tieBreakOptionsByBattle = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getAdminBattleTieBreakOptions>>();
    battles.forEach((battle) => {
      map.set(
        battle.id,
        getAdminBattleTieBreakOptions({
          battle,
          entries,
          submissions,
          votes,
        }),
      );
    });
    return map;
  }, [battles, entries, submissions, votes]);

  const openCreateForm = () => {
    setEditingBattle(null);
    setFormVisible(true);
  };

  const openBattle = (battle: Battle) => {
    setEditingBattle(battle);
    setFormVisible(true);
  };

  const closeForm = () => {
    setEditingBattle(null);
    setFormVisible(false);
  };

  const resolveTieBreak = async (battleId: string, submissionId: string) => {
    const key = `${battleId}:${submissionId}`;
    if (!confirm('Registrar este desempate?')) return;

    setTieBreakingKey(key);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Sessao expirada. Entre novamente.');
      const response = await fetch(`${getWebApiBaseUrl()}/api/battles/${battleId}/tiebreak`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao desempatar batalha');
      toast.success('Desempate registrado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desempatar batalha');
    } finally {
      setTieBreakingKey(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Batalhas</h1>
          <p className="mt-1 text-surface-400">
            Acompanhe batalhas criadas na plataforma. Finalizacao fica com o criador.
          </p>
        </div>
        <Button onClick={openCreateForm}>Nova batalha</Button>
      </div>

      {formVisible && (
        <BattleForm
          key={editingBattle?.id ?? 'new'}
          battle={editingBattle}
          onCancel={closeForm}
          onSaved={closeForm}
        />
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
          Todas as batalhas
        </h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <EmptyState
            title="Nenhuma batalha ainda"
            description="As batalhas criadas aparecerao aqui."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <SortableTableHeader
                    label="Batalha"
                    active={sort.key === 'battle'}
                    direction={sort.direction}
                    onClick={() => setSort((current) => getNextSortState(current, 'battle'))}
                  />
                  <SortableTableHeader
                    label="Status"
                    active={sort.key === 'status'}
                    direction={sort.direction}
                    onClick={() => setSort((current) => getNextSortState(current, 'status'))}
                  />
                  <SortableTableHeader
                    label="Participantes"
                    active={sort.key === 'participants'}
                    direction={sort.direction}
                    align="right"
                    onClick={() =>
                      setSort((current) => getNextSortState(current, 'participants'))
                    }
                  />
                  <SortableTableHeader
                    label="Inscricao"
                    active={sort.key === 'entryFee'}
                    direction={sort.direction}
                    align="right"
                    onClick={() => setSort((current) => getNextSortState(current, 'entryFee'))}
                  />
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedBattles.map((battle) => {
                  const status = STATUS_MAP[battle.status] || STATUS_MAP.draft!;
                  const regEnd = toDate(battle.registrationEnd);
                  const tieBreakOptions = tieBreakOptionsByBattle.get(battle.id) ?? [];

                  return (
                    <tr
                      key={battle.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openBattle(battle)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openBattle(battle);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{battle.title}</p>
                        <p className="text-xs capitalize text-surface-500">
                          {battle.category} ·{' '}
                          {battle.type === 'official' ? 'oficial' : 'comunidade'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.color as 'default' | 'success' | 'info' | 'purple'}>
                          {status.label}
                        </Badge>
                        {regEnd && battle.status === 'registration' && (
                          <p className="mt-1 text-xs text-surface-500">
                            {formatRelativeTime(regEnd)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300">
                        {battle.currentParticipants}
                        {battle.maxParticipants > 0 && (
                          <span className="text-surface-600">/{battle.maxParticipants}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {battle.entryFee > 0 ? (
                          <span className="font-medium text-brand-400">
                            {formatCurrency(battle.entryFee)}
                          </span>
                        ) : (
                          <span className="text-surface-500">Gratis</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {tieBreakOptions.map((option) => {
                            const key = `${battle.id}:${option.id}`;
                            return (
                              <Button
                                key={option.id}
                                size="sm"
                                variant="secondary"
                                loading={tieBreakingKey === key}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  resolveTieBreak(battle.id, option.id);
                                }}
                              >
                                Desempatar {option.userDisplayName ?? option.userId}
                              </Button>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openBattle(battle);
                            }}
                          >
                            Abrir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
