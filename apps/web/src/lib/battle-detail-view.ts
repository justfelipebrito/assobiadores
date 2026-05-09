import { Calendar, Music, Trophy, Vote, type LucideIcon } from 'lucide-react';
import type { Battle, BattleEntry, Submission } from '@batalha/types';
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
    return 'Comunidade decide o resultado. Em empate, o criador desempata. Participantes não votam.';
  }
  return 'Comunidade decide o resultado. Em empate, o criador desempata. Participantes não votam.';
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

function getEntryCreatedAtMillis(entry: Pick<BattleEntry, 'createdAt'>) {
  const createdAt = toDate(entry.createdAt);
  return createdAt?.getTime() ?? 0;
}

export function sortBattleEntriesByCreatedAt(entries: BattleEntry[]) {
  return [...entries].sort(
    (a, b) => getEntryCreatedAtMillis(a) - getEntryCreatedAtMillis(b),
  );
}

export function sortBattleSubmissionsByVoteCount(submissions: Submission[]) {
  return [...submissions].sort((a, b) => b.voteCount - a.voteCount);
}

type BattleWinnerSummary = Pick<Battle['winners'][number], 'userId' | 'place'>;
type SubmissionResultFields = Pick<Submission, 'voteCount'> & {
  publicVoteCount?: number | null;
  judgeVoteCount?: number | null;
};

function getWinnerPlace(winners: BattleWinnerSummary[], userId: string) {
  return winners.find((winner) => winner.place === 1 && winner.userId === userId)?.place ?? null;
}

function getSubmissionVoteCount(submission: Pick<Submission, 'voteCount'> | undefined) {
  if (!submission) return 0;
  return getBattleSubmissionResultBreakdown(submission).publicVoteCount;
}

export function sortBattleEntriesForDisplay({
  battle,
  entries,
  submissionsByUserId,
}: {
  battle: Pick<Battle, 'status' | 'winners'>;
  entries: BattleEntry[];
  submissionsByUserId?: Map<string, Pick<Submission, 'voteCount'>>;
}) {
  if (battle.status !== 'finished') return entries;

  return [...entries].sort((a, b) => {
    const aPlace = getWinnerPlace(battle.winners, a.userId);
    const bPlace = getWinnerPlace(battle.winners, b.userId);

    if (aPlace && bPlace) return aPlace - bPlace;
    if (aPlace) return -1;
    if (bPlace) return 1;

    return (
      getSubmissionVoteCount(submissionsByUserId?.get(b.userId)) -
      getSubmissionVoteCount(submissionsByUserId?.get(a.userId))
    );
  });
}

export function sortBattleSubmissionsForResult({
  battle,
  submissions,
}: {
  battle: Pick<Battle, 'status' | 'winners'>;
  submissions: Submission[];
}) {
  if (battle.status !== 'finished') return submissions;

  return [...submissions].sort((a, b) => {
    const aPlace = getWinnerPlace(battle.winners, a.userId);
    const bPlace = getWinnerPlace(battle.winners, b.userId);

    if (aPlace && bPlace) return aPlace - bPlace;
    if (aPlace) return -1;
    if (bPlace) return 1;

    return (
      getBattleSubmissionResultBreakdown(b).publicVoteCount -
      getBattleSubmissionResultBreakdown(a).publicVoteCount
    );
  });
}

export function getBattleSubmissionResultBreakdown(submission: SubmissionResultFields) {
  const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
  const judgeVoteCount =
    typeof submission.judgeVoteCount === 'number' ? Math.max(0, submission.judgeVoteCount) : 0;
  const publicVoteCount =
    typeof submission.publicVoteCount === 'number'
      ? Math.max(0, submission.publicVoteCount)
      : Math.max(0, voteCount - judgeVoteCount);

  return {
    publicVoteCount,
    hasCreatorVote: judgeVoteCount > 0,
  };
}
