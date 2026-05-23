type PlaybackListener = (activePlayerId: string) => void;

const listeners = new Set<PlaybackListener>();
let activePlayerId: string | null = null;

export function requestExclusiveAudioPlayback(playerId: string) {
  activePlayerId = playerId;
  listeners.forEach((listener) => listener(playerId));
}

export function clearExclusiveAudioPlayback(playerId: string) {
  if (activePlayerId === playerId) {
    activePlayerId = null;
  }
}

export function subscribeToExclusiveAudioPlayback(listener: PlaybackListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSeekRatioFromClientX({
  clientX,
  left,
  width,
}: {
  clientX: number;
  left: number;
  width: number;
}) {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) {
    return null;
  }

  return Math.min(1, Math.max(0, (clientX - left) / width));
}

export function getSeekTimeFromRatio({
  ratio,
  durationSeconds,
}: {
  ratio: number | null;
  durationSeconds: number | null;
}) {
  if (ratio === null || durationSeconds === null || durationSeconds <= 0) return null;
  return Math.min(durationSeconds, Math.max(0, durationSeconds * ratio));
}
