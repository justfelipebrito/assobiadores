import type { DailyHighlight } from '@batalha/types';
import { toDate } from '@batalha/utils';

export function sortDailyHighlightsByVotes(highlights: DailyHighlight[]) {
  return [...highlights].sort((a, b) => {
    const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
    if (voteDiff !== 0) return voteDiff;

    const aCreatedAt = toDate(a.createdAt)?.getTime() ?? 0;
    const bCreatedAt = toDate(b.createdAt)?.getTime() ?? 0;
    return aCreatedAt - bCreatedAt;
  });
}

export function getVisibleDailyHighlights({
  highlights,
  limit,
  now = new Date(),
}: {
  highlights: DailyHighlight[];
  limit?: number;
  now?: Date;
}) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todaysApproved = highlights.filter((highlight) => {
    const createdAt = toDate(highlight.createdAt);
    return highlight.status === 'active' && createdAt
      ? createdAt.getTime() >= todayStart.getTime()
      : false;
  });
  const sorted = sortDailyHighlightsByVotes(todaysApproved);

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}
