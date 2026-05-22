export function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export function getValidDuration(seconds?: number | null) {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function formatDurationLabel(seconds?: number | null) {
  const duration = getValidDuration(seconds);
  return duration === null ? '--:--' : formatTime(duration);
}
