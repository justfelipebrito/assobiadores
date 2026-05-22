import type { Battle, BattleEntry, Submission, Vote } from '@batalha/types';
import { toDate } from '@batalha/utils';

function getPublicVoteCount(submission: Pick<Submission, 'voteCount'> & {
  publicVoteCount?: number | null;
  judgeVoteCount?: number | null;
}) {
  if (typeof submission.publicVoteCount === 'number') return Math.max(0, submission.publicVoteCount);
  const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
  const judgeVoteCount =
    typeof submission.judgeVoteCount === 'number' ? Math.max(0, submission.judgeVoteCount) : 0;
  return Math.max(0, voteCount - judgeVoteCount);
}

export function getAdminBattleTieBreakOptions({
  battle,
  entries,
  submissions,
  votes,
  now = new Date(),
}: {
  battle: Pick<Battle, 'id' | 'status' | 'votingEnd'>;
  entries: Array<Pick<BattleEntry, 'battleId' | 'userId' | 'status'>>;
  submissions: Array<
    Pick<Submission, 'id' | 'battleId' | 'userId' | 'status' | 'voteCount'> & {
      userDisplayName?: string | null;
      publicVoteCount?: number | null;
      judgeVoteCount?: number | null;
    }
  >;
  votes: Array<Pick<Vote, 'battleId' | 'voterType'>>;
  now?: Date;
}) {
  const votingEnd = toDate(battle.votingEnd);
  const hasTieBreak = votes.some(
    (vote) => vote.battleId === battle.id && vote.voterType === 'judge',
  );
  if (battle.status !== 'voting' || !votingEnd || now.getTime() < votingEnd.getTime() || hasTieBreak) {
    return [];
  }

  const confirmedUserIds = new Set(
    entries
      .filter((entry) => entry.battleId === battle.id && entry.status === 'confirmed')
      .map((entry) => entry.userId),
  );
  const eligible = submissions
    .filter(
      (submission) =>
        submission.battleId === battle.id &&
        submission.status === 'approved' &&
        confirmedUserIds.has(submission.userId),
    )
    .map((submission) => ({
      id: submission.id,
      userDisplayName: submission.userDisplayName,
      userId: submission.userId,
      publicVoteCount: getPublicVoteCount(submission),
    }));

  if (eligible.length < 2) return [];
  const topVotes = Math.max(...eligible.map((submission) => submission.publicVoteCount));
  const tied = eligible.filter((submission) => submission.publicVoteCount === topVotes);
  return tied.length >= 2 ? tied : [];
}
