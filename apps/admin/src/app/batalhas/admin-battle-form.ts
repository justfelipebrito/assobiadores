import { z } from 'zod';
import type { Battle } from '@batalha/types';
import {
  battleCategorySchema,
  battleFormatSchema,
  battleStatusSchema,
  battleTypeSchema,
  votingTypeSchema,
} from '@batalha/types';

export const ADMIN_BATTLE_RULE_LIMIT = 10;

export const ADMIN_BATTLE_TYPE_OPTIONS = [
  { value: 'official', label: 'Oficial' },
  { value: 'community', label: 'Comunidade' },
] as const;

export const ADMIN_BATTLE_FORMAT_OPTIONS = [
  { value: 'group', label: 'Grupo' },
  { value: 'duel', label: '1 vs 1' },
] as const;

export const ADMIN_BATTLE_CATEGORY_OPTIONS = [
  { value: 'classico', label: 'Classico' },
  { value: 'imitacao', label: 'Imitacao' },
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
] as const;

export const ADMIN_BATTLE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'registration', label: 'Inscricoes' },
  { value: 'active', label: 'Em andamento' },
  { value: 'voting', label: 'Em votacao' },
  { value: 'finished', label: 'Finalizada' },
] as const;

export const ADMIN_BATTLE_VOTING_OPTIONS = [
  { value: 'public', label: 'Publico' },
  { value: 'judge', label: 'Juri' },
  { value: 'hybrid', label: 'Hibrido' },
] as const;

export interface AdminBattleFormValues {
  title: string;
  description: string;
  type: string;
  format: string;
  category: string;
  status: string;
  entryFee: string;
  prizePool: string;
  maxParticipants: string;
  votingType: string;
  registrationStart: string;
  registrationEnd: string;
  submissionDeadline: string;
  votingStart: string;
  votingEnd: string;
  rulesText: string;
}

export interface AdminBattlePayload {
  title: string;
  description: string;
  type: z.infer<typeof battleTypeSchema>;
  format: z.infer<typeof battleFormatSchema>;
  category: z.infer<typeof battleCategorySchema>;
  status: z.infer<typeof battleStatusSchema>;
  entryFee: number;
  prizePool: number;
  prizeDistribution: null;
  votingType: z.infer<typeof votingTypeSchema>;
  maxParticipants: number;
  registrationStart: Date;
  registrationEnd: Date;
  submissionDeadline: Date;
  votingStart: Date;
  votingEnd: Date;
  rules: string[];
  judges: string[];
}

export interface AdminBattleValidationResult {
  payload: AdminBattlePayload | null;
  error: string | null;
}

const requiredDateSchema = z.string().min(1);

const adminBattleFormSchema = z.object({
  title: z.string().trim().min(3, 'Titulo precisa ter pelo menos 3 caracteres.').max(200),
  description: z.string().trim().max(2000),
  type: battleTypeSchema,
  format: battleFormatSchema,
  category: battleCategorySchema,
  status: battleStatusSchema,
  votingType: votingTypeSchema,
  entryFee: z.coerce.number().int().nonnegative(),
  prizePool: z.coerce.number().int().nonnegative(),
  maxParticipants: z.coerce.number().int().min(2),
  registrationStart: requiredDateSchema,
  registrationEnd: requiredDateSchema,
  submissionDeadline: requiredDateSchema,
  votingStart: requiredDateSchema,
  votingEnd: requiredDateSchema,
  rulesText: z.string(),
});

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

export function toDatetimeLocalInput(value: unknown): string {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : typeof value === 'object' && value !== null && 'seconds' in value
        ? new Date(Number((value as { seconds: number }).seconds) * 1000)
        : null;

  if (!date || Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function createDefaultAdminBattleFormValues(now = new Date()): AdminBattleFormValues {
  return {
    title: '',
    description: '',
    type: 'official',
    format: 'group',
    category: 'classico',
    status: 'draft',
    entryFee: '0',
    prizePool: '0',
    maxParticipants: '32',
    votingType: 'public',
    registrationStart: toDatetimeLocalInput(now),
    registrationEnd: toDatetimeLocalInput(addHours(now, 24 * 7)),
    submissionDeadline: toDatetimeLocalInput(addHours(now, 24 * 10)),
    votingStart: toDatetimeLocalInput(addHours(now, 24 * 10)),
    votingEnd: toDatetimeLocalInput(addHours(now, 24 * 14)),
    rulesText: '',
  };
}

export function battleToAdminFormValues(battle: Battle): AdminBattleFormValues {
  return {
    title: battle.title,
    description: battle.description ?? '',
    type: battle.type,
    format: battle.format ?? 'group',
    category: battle.category,
    status: battle.status,
    entryFee: String(battle.entryFee ?? 0),
    prizePool: String(battle.prizePool ?? 0),
    maxParticipants: String(battle.maxParticipants ?? 2),
    votingType: battle.votingType ?? 'public',
    registrationStart: toDatetimeLocalInput(battle.registrationStart),
    registrationEnd: toDatetimeLocalInput(battle.registrationEnd),
    submissionDeadline: toDatetimeLocalInput(battle.submissionDeadline),
    votingStart: toDatetimeLocalInput(battle.votingStart),
    votingEnd: toDatetimeLocalInput(battle.votingEnd),
    rulesText: (battle.rules ?? []).join('\n'),
  };
}

export function validateAdminBattleForm(values: AdminBattleFormValues): AdminBattleValidationResult {
  const parsed = adminBattleFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      payload: null,
      error: parsed.error.issues[0]?.message ?? 'Revise os campos da batalha.',
    };
  }

  const rules = parsed.data.rulesText
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean);

  if (rules.length > ADMIN_BATTLE_RULE_LIMIT) {
    return {
      payload: null,
      error: `Use no maximo ${ADMIN_BATTLE_RULE_LIMIT} regras.`,
    };
  }

  const registrationStart = new Date(parsed.data.registrationStart);
  const registrationEnd = new Date(parsed.data.registrationEnd);
  const submissionDeadline = new Date(parsed.data.submissionDeadline);
  const votingStart = new Date(parsed.data.votingStart);
  const votingEnd = new Date(parsed.data.votingEnd);

  if (
    [registrationStart, registrationEnd, submissionDeadline, votingStart, votingEnd].some((date) =>
      Number.isNaN(date.getTime()),
    )
  ) {
    return { payload: null, error: 'Informe datas validas.' };
  }

  if (registrationEnd <= registrationStart) {
    return { payload: null, error: 'Fim das inscricoes precisa ser depois do inicio.' };
  }

  if (submissionDeadline < registrationEnd) {
    return { payload: null, error: 'Prazo de envio precisa ser depois das inscricoes.' };
  }

  if (votingStart < submissionDeadline) {
    return { payload: null, error: 'Inicio da votacao precisa ser depois do prazo de envio.' };
  }

  if (votingEnd <= votingStart) {
    return { payload: null, error: 'Fim da votacao precisa ser depois do inicio.' };
  }

  return {
    payload: {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      format: parsed.data.format,
      category: parsed.data.category,
      status: parsed.data.status,
      entryFee: parsed.data.entryFee,
      prizePool: parsed.data.prizePool,
      prizeDistribution: null,
      votingType: parsed.data.votingType,
      maxParticipants: parsed.data.format === 'duel' ? 2 : parsed.data.maxParticipants,
      registrationStart,
      registrationEnd,
      submissionDeadline,
      votingStart,
      votingEnd,
      rules,
      judges: [],
    },
    error: null,
  };
}
