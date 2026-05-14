import type { DailyHighlight, HomepageSettings } from '@batalha/types';
import { toDate } from '@batalha/utils';

export const DAILY_HIGHLIGHTS_MIN_DAY_KEY = '2026-05-01';

export function getBrazilDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function sortDailyHighlightsByVotes(highlights: DailyHighlight[]) {
  return [...highlights].sort((a, b) => {
    const aPlacement = typeof a.placement === 'number' ? a.placement : null;
    const bPlacement = typeof b.placement === 'number' ? b.placement : null;
    if (aPlacement !== null || bPlacement !== null) {
      if (aPlacement === null) return 1;
      if (bPlacement === null) return -1;
      if (aPlacement !== bPlacement) return aPlacement - bPlacement;
    }

    const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
    if (voteDiff !== 0) return voteDiff;

    const aCreatedAt = toDate(a.createdAt)?.getTime() ?? 0;
    const bCreatedAt = toDate(b.createdAt)?.getTime() ?? 0;
    return aCreatedAt - bCreatedAt;
  });
}

export function formatBrazilDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-');
  if (!year || !month || !day) return dayKey;

  return `${day}/${month}/${year}`;
}

export function getDailyHighlightPromoText(
  settings: HomepageSettings | null | undefined,
  dayKey = getBrazilDayKey(),
) {
  if (!settings?.dailyHighlightBannerEnabled) return null;

  const text = settings.dailyHighlightBannerText?.trim();
  if (!text) return null;

  const endDayKey = settings.dailyHighlightBannerEndDayKey?.trim();
  if (endDayKey && dayKey > endDayKey) return null;

  return text;
}

export function getDailyHighlightPlacementLabel(highlight: Pick<DailyHighlight, 'placement'>) {
  if (highlight.placement === 1) return '1º lugar';
  if (highlight.placement === 2) return '2º lugar';
  if (highlight.placement === 3) return '3º lugar';
  return null;
}

export function getDailyHighlightPodiumMeta(placement: number | null | undefined) {
  if (placement === 1) {
    return { label: '1º lugar', tone: 'gold' as const, shortLabel: '1º' };
  }
  if (placement === 2) {
    return { label: '2º lugar', tone: 'silver' as const, shortLabel: '2º' };
  }
  if (placement === 3) {
    return { label: '3º lugar', tone: 'bronze' as const, shortLabel: '3º' };
  }
  return null;
}

export function shiftBrazilDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;

  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

export function getDailyHighlightDayKeys(highlights: DailyHighlight[], todayKey = getBrazilDayKey()) {
  return Array.from(
    new Set(
      highlights
        .map((highlight) => highlight.dayKey)
        .filter((dayKey): dayKey is string => Boolean(dayKey) && dayKey <= todayKey),
    ),
  ).sort((a, b) => b.localeCompare(a));
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
  const dayKey = getBrazilDayKey(now);

  const todaysApproved = highlights.filter((highlight) => {
    const status = highlight.status ?? 'active';
    return ['active', 'finalized'].includes(status) && highlight.dayKey === dayKey;
  });
  const sorted = sortDailyHighlightsByVotes(todaysApproved);

  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
}

export function getDailyHighlightsForDay({
  dayKey,
  highlights,
  todayKey = getBrazilDayKey(),
}: {
  dayKey: string;
  highlights: DailyHighlight[];
  todayKey?: string;
}) {
  if (dayKey === todayKey) {
    return getVisibleDailyHighlights({ highlights });
  }

  return sortDailyHighlightsByVotes(
    highlights.filter((highlight) => {
      return highlight.dayKey === dayKey && highlight.status === 'finalized';
    }),
  ).slice(0, 3);
}
