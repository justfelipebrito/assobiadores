export function shouldShowSubmitDailyHighlightButton({
  isAuthenticated,
  hasSubmittedToday,
}: {
  isAuthenticated: boolean;
  hasSubmittedToday: boolean;
}) {
  return isAuthenticated && !hasSubmittedToday;
}
