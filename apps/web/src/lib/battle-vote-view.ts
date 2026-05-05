import type { Battle, Submission, Vote } from '@batalha/types';

export function getBattleVoteForUser(votes: Vote[]) {
  return votes[0] ?? null;
}

export function getBattleSubmissionVoteState({
  submissionId,
  currentVote,
  canVote,
}: {
  submissionId: string;
  currentVote: Vote | null;
  canVote: boolean;
}) {
  const isSelectedVote = currentVote?.submissionId === submissionId;
  const hasVoted = Boolean(currentVote);

  return {
    isSelectedVote,
    canVote: canVote && !hasVoted,
    buttonLabel: 'Votar',
  };
}

export function getBattleWinnerForSubmission({
  battle,
  submission,
}: {
  battle: Pick<Battle, 'winners'>;
  submission: Pick<Submission, 'userId'> | null;
}) {
  if (!submission) return null;
  return battle.winners.find((winner) => winner.userId === submission.userId) ?? null;
}

export function getBattleWinnerBadgeLabel(place: number) {
  if (place === 1) return 'Vencedor';
  return `${place}º lugar`;
}

