import type { BattleEntry, DailyHighlight, PointActivity, Submission, User } from '@batalha/types';

export interface PublicProfileStatsInput {
  user: User;
  battleEntries: BattleEntry[];
  submissions: Submission[];
  dailyHighlights: DailyHighlight[];
  pointActivities: PointActivity[];
}

export function getPublicProfileStats({
  user,
  battleEntries,
  submissions,
  dailyHighlights,
  pointActivities,
}: PublicProfileStatsInput) {
  const confirmedBattleEntries = battleEntries.filter((entry) => entry.status === 'confirmed');
  const battleWinsFromLedger = pointActivities.filter(
    (activity) => activity.reason === 'battle_win',
  ).length;
  const dailyTopThree = dailyHighlights.filter(
    (highlight) =>
      typeof highlight.placement === 'number' && highlight.placement >= 1 && highlight.placement <= 3,
  ).length;
  const submissionVotes = submissions.reduce((sum, submission) => sum + (submission.voteCount ?? 0), 0);
  const dailyHighlightVotes = dailyHighlights.reduce(
    (sum, highlight) => sum + (highlight.voteCount ?? 0),
    0,
  );

  return {
    battlesEntered: Math.max(user.stats?.battlesEntered ?? 0, confirmedBattleEntries.length),
    battlesWon: Math.max(user.stats?.battlesWon ?? 0, battleWinsFromLedger),
    topThreeFinishes: Math.max(user.stats?.topThreeFinishes ?? 0, dailyTopThree),
    totalVotesReceived: Math.max(
      user.stats?.totalVotesReceived ?? 0,
      submissionVotes + dailyHighlightVotes,
    ),
  };
}

export function getPointActivitySecondaryText(activity: PointActivity) {
  const parts = [activity.sourceTitle, activity.category].filter(Boolean);
  return parts.join(' · ');
}
