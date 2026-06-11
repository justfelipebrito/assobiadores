'use client';

import { type FormEvent, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getClientAuth,
  getClientFirestore,
  serverTimestamp,
  updateDoc,
  useAuth,
} from '@batalha/firebase';
import { Button, Card, CardContent, Input, Textarea } from '@batalha/ui';
import { toast } from 'sonner';
import type { Battle } from '@batalha/types';
import { getWebApiBaseUrl } from '../../lib/web-api';
import {
  ADMIN_BATTLE_CATEGORY_OPTIONS,
  ADMIN_BATTLE_FORMAT_OPTIONS,
  ADMIN_BATTLE_STATUS_OPTIONS,
  ADMIN_BATTLE_TYPE_OPTIONS,
  battleToAdminFormValues,
  createDefaultAdminBattleFormValues,
  shouldFinalizeBattleThroughTrustedApi,
  type AdminBattleFormValues,
  validateAdminBattleForm,
} from './admin-battle-form';

interface AdminBattleConfigModalProps {
  battle: Battle | null;
  onClose: () => void;
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

export function AdminBattleConfigModal({
  battle,
  onClose,
  onSaved,
}: AdminBattleConfigModalProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<AdminBattleFormValues>(() =>
    battle ? battleToAdminFormValues(battle) : createDefaultAdminBattleFormValues(),
  );
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(battle);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
        const shouldFinalize = shouldFinalizeBattleThroughTrustedApi({
          currentStatus: battle.status,
          nextStatus: result.payload.status,
        });

        if (shouldFinalize) {
          const token = await getClientAuth().currentUser?.getIdToken();
          if (!token) throw new Error('Sessao expirada. Entre novamente.');
          const response = await fetch(`${getWebApiBaseUrl()}/api/admin/battles/finalize`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ battleId: battle.id }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Erro ao finalizar batalha');
          toast.success('Batalha finalizada com pontuacao processada.');
        } else {
          await updateDoc(doc(db, 'battles', battle.id), {
            ...result.payload,
            currentParticipants: Math.min(
              battle.currentParticipants ?? 0,
              result.payload.maxParticipants,
            ),
            updatedAt: now,
          });
          toast.success('Batalha atualizada.');
        }
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-config-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-surface-950 shadow-2xl sm:max-w-5xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <Card className="border-0 bg-transparent shadow-none">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="battle-config-title" className="text-lg font-semibold text-white">
                    {isEditing ? 'Configurações da batalha' : 'Nova batalha'}
                  </h2>
                  <p className="mt-1 text-sm text-surface-400">
                    Configure tipo, fases e regras antes de abrir inscricoes.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Fechar
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
                Votacao: comunidade decide o resultado. Criador ou admin desempata somente apos o
                fim da votacao. Participantes nao votam na propria batalha.
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
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                  {isEditing ? 'Salvar alteracoes' : 'Criar batalha'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
