export type DailyHighlightLikeView = {
  dailyHighlightId: string;
  userId: string;
  dayKey: string;
};

export function getDailyHighlightLikeForVisibleDay({
  likes,
  visibleDayKey,
}: {
  likes: DailyHighlightLikeView[];
  visibleDayKey: string | null;
}) {
  if (!visibleDayKey) return null;
  return likes.find((like) => like.dayKey === visibleDayKey) ?? null;
}

export function getDailyHighlightVoteState({
  highlightId,
  like,
}: {
  highlightId: string;
  like: DailyHighlightLikeView | null;
}) {
  const hasVotedToday = Boolean(like);
  const isSelectedVote = like?.dailyHighlightId === highlightId;

  return {
    hasVotedToday,
    isSelectedVote,
    buttonLabel: isSelectedVote ? 'Seu voto' : 'Votar',
    canVote: !hasVotedToday,
  };
}
