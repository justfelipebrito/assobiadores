const YOUTUBE_PATTERNS = [
  /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
  /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+/,
];

const TIKTOK_PATTERNS = [
  /^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  /^https?:\/\/vm\.tiktok\.com\/[\w-]+/,
];

const INSTAGRAM_PATTERNS = [
  /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[\w-]+/,
];

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'other';

export function detectVideoPlatform(url: string): VideoPlatform {
  if (YOUTUBE_PATTERNS.some((p) => p.test(url))) return 'youtube';
  if (TIKTOK_PATTERNS.some((p) => p.test(url))) return 'tiktok';
  if (INSTAGRAM_PATTERNS.some((p) => p.test(url))) return 'instagram';
  return 'other';
}

export function isValidVideoURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractYouTubeId(url: string): string | null {
  const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (shortMatch) return shortMatch[1] ?? null;

  const longMatch = url.match(/[?&]v=([\w-]+)/);
  if (longMatch) return longMatch[1] ?? null;

  const shortsMatch = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (shortsMatch) return shortsMatch[1] ?? null;

  return null;
}
