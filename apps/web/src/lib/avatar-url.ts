export function getVersionedAvatarUrl(
  photoURL?: string | null,
  photoVersion?: number | null,
): string | undefined {
  if (!photoURL) return undefined;
  const separator = photoURL.includes('?') ? '&' : '?';
  return `${photoURL}${separator}v=${photoVersion ?? 0}`;
}
