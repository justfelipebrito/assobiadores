import type { Championship, Match, MatchStatus, Stage, StageName, StageStatus, StageType } from '@batalha/types';

export const STAGE_NAME_OPTIONS: Array<{ value: StageName; label: string }> = [
  { value: 'Fase de Grupos', label: 'Fase de Grupos' },
  { value: 'Rodada de 32', label: 'Rodada de 32' },
  { value: 'Rodada de 16', label: 'Rodada de 16' },
  { value: 'Quartas de Final', label: 'Quartas de Final' },
  { value: 'Semifinal', label: 'Semifinal' },
  { value: 'Final', label: 'Final' },
];

export const STAGE_TYPE_OPTIONS: Array<{ value: StageType; label: string }> = [
  { value: 'group', label: 'Grupo' },
  { value: 'knockout', label: 'Mata-mata' },
];

export const STAGE_STATUS_OPTIONS: Array<{ value: StageStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'active', label: 'Ativa' },
  { value: 'finished', label: 'Finalizada' },
];

export const MATCH_STATUS_OPTIONS: Array<{ value: MatchStatus; label: string }> = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'active', label: 'Ativa' },
  { value: 'voting', label: 'Em votacao' },
  { value: 'finished', label: 'Finalizada' },
];

export interface StageFormValues {
  name: StageName;
  type: StageType;
  status: StageStatus;
  order: string;
  participantIdsText: string;
}

export interface MatchFormValues {
  status: MatchStatus;
  scheduledAt: string;
  participantIdsText: string;
  battleId: string;
}

export function parseParticipantIds(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createDefaultStageFormValues(order: number): StageFormValues {
  return {
    name: 'Fase de Grupos',
    type: 'group',
    status: 'pending',
    order: String(order),
    participantIdsText: '',
  };
}

export function createDefaultMatchFormValues(now = new Date()): MatchFormValues {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);

  return {
    status: 'scheduled',
    scheduledAt: local.toISOString().slice(0, 16),
    participantIdsText: '',
    battleId: '',
  };
}

export function buildStagePayload(values: StageFormValues) {
  const order = Number.parseInt(values.order, 10);
  if (Number.isNaN(order) || order < 0) {
    throw new Error('Ordem da fase precisa ser um numero positivo.');
  }

  return {
    name: values.name,
    type: values.type,
    status: values.status,
    order,
    participantIds: parseParticipantIds(values.participantIdsText),
  };
}

export function buildMatchPayload(values: MatchFormValues) {
  const participantIds = parseParticipantIds(values.participantIdsText);
  if (participantIds.length < 2) {
    throw new Error('Informe pelo menos dois competidores.');
  }

  const scheduledAt = new Date(values.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Informe uma data valida para a partida.');
  }

  return {
    participantIds,
    battleId: values.battleId.trim() || null,
    scheduledAt,
    status: values.status,
    winnerId: null,
    scores: {},
  };
}

export function getStageProgress(matches: Array<Pick<Match, 'status'>>) {
  const total = matches.length;
  const finished = matches.filter((match) => match.status === 'finished').length;
  const active = matches.filter((match) => match.status === 'active' || match.status === 'voting').length;

  return {
    total,
    finished,
    active,
    percent: total === 0 ? 0 : Math.round((finished / total) * 100),
  };
}

export function getMatchTitle(match: Pick<Match, 'participantIds'>) {
  return match.participantIds.length > 0 ? match.participantIds.join(' vs ') : 'Partida sem competidores';
}

export function getMatchStatusLabel(status: MatchStatus) {
  return MATCH_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function canFinalizeMatch(match: Pick<Match, 'status'>) {
  return match.status === 'voting';
}

export function canFinalizeChampionship(
  championship: Pick<Championship, 'status'>,
  stages: Array<Pick<Stage, 'status'>>,
) {
  return championship.status !== 'finished' && stages.length > 0 && stages.every((stage) => stage.status === 'finished');
}
