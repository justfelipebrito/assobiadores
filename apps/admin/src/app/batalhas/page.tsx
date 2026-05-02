'use client';

import { type FormEvent, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  orderBy,
  serverTimestamp,
  updateDoc,
  useAuth,
  useCollection,
} from '@batalha/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getClientFirestore } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Input, Skeleton, Textarea } from '@batalha/ui';
import { formatCurrency, formatRelativeTime, toDate } from '@batalha/utils';
import { toast } from 'sonner';
import type { Battle } from '@batalha/types';
import {
  ADMIN_BATTLE_CATEGORY_OPTIONS,
  ADMIN_BATTLE_FORMAT_OPTIONS,
  ADMIN_BATTLE_STATUS_OPTIONS,
  ADMIN_BATTLE_TYPE_OPTIONS,
  ADMIN_BATTLE_VOTING_OPTIONS,
  battleToAdminFormValues,
  createDefaultAdminBattleFormValues,
  type AdminBattleFormValues,
  validateAdminBattleForm,
} from './admin-battle-form';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'default' },
  registration: { label: 'Inscricoes', color: 'success' },
  active: { label: 'Em andamento', color: 'info' },
  voting: { label: 'Em votacao', color: 'purple' },
  finished: { label: 'Finalizada', color: 'default' },
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
          currentParticipants: Math.min(battle.currentParticipants ?? 0, result.payload.maxParticipants),
          updatedAt: now,
        });
        toast.success('Batalha atualizada.');
      } else {
        const battleRef = await addDoc(collection(db, 'battles'), {
          ...result.payload,
          currentParticipants: 0,
          winners: [],
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
            <SelectField
              label="Votacao"
              value={values.votingType}
              onChange={(value) => setValue('votingType', value)}
              options={ADMIN_BATTLE_VOTING_OPTIONS}
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
              onChange={(event) => setValue('prizePool', event.target.value)}
            />
          </div>

          <Textarea
            label="Descricao"
            value={values.description}
            onChange={(event) => setValue('description', event.target.value)}
            maxLength={2000}
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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

function FinalizeBattleButton({ battle }: { battle: Battle }) {
  const [loading, setLoading] = useState(false);

  const handleFinalize = async () => {
    if (!confirm(`Finalizar "${battle.title}"? Esta acao nao pode ser desfeita.`)) return;

    setLoading(true);
    try {
      const db = getClientFirestore();
      const functions = getFunctions(db.app, 'southamerica-east1');
      const finalizeBattle = httpsCallable(functions, 'finalizeBattle');
      const result = await finalizeBattle({ battleId: battle.id });
      const data = result.data as { success: boolean; winners: Array<{ userId: string; place: number }> };
      toast.success(`Batalha finalizada! ${data.winners.length} vencedor(es) definido(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao finalizar batalha';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={handleFinalize} loading={loading}>
      Finalizar
    </Button>
  );
}

export default function AdminBattlesPage() {
  const [editingBattle, setEditingBattle] = useState<Battle | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const { data: battles, loading } = useCollection<Battle>('battles', [orderBy('createdAt', 'desc')]);

  const votingBattles = battles.filter((battle) => battle.status === 'voting');

  const openCreateForm = () => {
    setEditingBattle(null);
    setFormVisible(true);
  };

  const openEditForm = (battle: Battle) => {
    setEditingBattle(battle);
    setFormVisible(true);
  };

  const closeForm = () => {
    setEditingBattle(null);
    setFormVisible(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Batalhas</h1>
          <p className="mt-1 text-surface-400">Gerencie e finalize batalhas</p>
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

      {!loading && votingBattles.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-yellow-400">
            Aguardando finalizacao ({votingBattles.length})
          </h2>
          <div className="space-y-3">
            {votingBattles.map((battle) => (
              <Card key={battle.id}>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="purple">Em votacao</Badge>
                        {battle.type === 'official' && <Badge variant="gold">Oficial</Badge>}
                      </div>
                      <p className="mt-2 truncate font-semibold text-white">{battle.title}</p>
                      <p className="mt-1 text-sm text-surface-400">
                        {battle.currentParticipants} participantes
                        {battle.prizePool > 0 && ` · Premio: ${formatCurrency(battle.prizePool)}`}
                      </p>
                    </div>
                    <FinalizeBattleButton battle={battle} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
          <EmptyState title="Nenhuma batalha ainda" description="As batalhas criadas aparecerao aqui." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Batalha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Participantes
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Inscricao
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {battles.map((battle) => {
                  const status = STATUS_MAP[battle.status] || STATUS_MAP.draft!;
                  const regEnd = toDate(battle.registrationEnd);

                  return (
                    <tr key={battle.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{battle.title}</p>
                        <p className="text-xs capitalize text-surface-500">
                          {battle.category} · {battle.type === 'official' ? 'oficial' : 'comunidade'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.color as 'default' | 'success' | 'info' | 'purple'}>
                          {status.label}
                        </Badge>
                        {regEnd && battle.status === 'registration' && (
                          <p className="mt-1 text-xs text-surface-500">{formatRelativeTime(regEnd)}</p>
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
                          <span className="font-medium text-brand-400">{formatCurrency(battle.entryFee)}</span>
                        ) : (
                          <span className="text-surface-500">Gratis</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditForm(battle)}>
                            Editar
                          </Button>
                          {battle.status === 'voting' && <FinalizeBattleButton battle={battle} />}
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
