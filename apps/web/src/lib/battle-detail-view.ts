import { Calendar, Music, Trophy, Vote, type LucideIcon } from 'lucide-react';
import type { Battle } from '@batalha/types';
import { toDate } from '@batalha/utils';

export type BattleScheduleItem = {
  icon: LucideIcon;
  label: string;
  date: Date | null;
};

export type BattleRuleCard = {
  title: string;
  description: string;
};

export function getVotingCopy(battle: Pick<Battle, 'format'>) {
  if (battle.format === 'duel') {
    return 'Comunidade vota, participantes não votam. Em empate, ninguém pontua.';
  }
  return 'Comunidade vale 70%; criador vale 30%. Participantes não votam.';
}

export function getBattleScheduleItems(
  battle: Pick<Battle, 'submissionDeadline' | 'votingStart' | 'votingEnd'>,
): BattleScheduleItem[] {
  return [
    { icon: Music, label: 'Envios até', date: toDate(battle.submissionDeadline) },
    { icon: Calendar, label: 'Votação inicia', date: toDate(battle.votingStart) },
    { icon: Vote, label: 'Votação encerra', date: toDate(battle.votingEnd) },
  ];
}

export function getBattleRuleCards(
  battle: Pick<Battle, 'entryFee' | 'format'>,
): BattleRuleCard[] {
  const cards = [{ title: 'Votação', description: getVotingCopy(battle) }];

  if (battle.entryFee > 0) {
    cards.push({
      title: 'Prêmio',
      description: '80% do valor total do pagamento da taxa de entrada.',
    });
  }

  return cards;
}

export function canSubmitBattleEntry({
  battle,
  hasConfirmedEntry,
  hasSubmission,
  now = new Date(),
}: {
  battle: Pick<Battle, 'status' | 'submissionDeadline'>;
  hasConfirmedEntry: boolean;
  hasSubmission: boolean;
  now?: Date;
}) {
  if (!hasConfirmedEntry || hasSubmission) return false;
  if (!['registration', 'active'].includes(battle.status)) return false;

  const submissionDeadline = toDate(battle.submissionDeadline);
  if (!submissionDeadline) return true;

  return now.getTime() <= submissionDeadline.getTime();
}

