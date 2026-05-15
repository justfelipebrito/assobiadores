export function shouldShowSubmitDailyHighlightButton({
  isAuthenticated,
  hasSubmittedToday,
}: {
  isAuthenticated: boolean;
  hasSubmittedToday: boolean;
}) {
  return !hasSubmittedToday;
}
