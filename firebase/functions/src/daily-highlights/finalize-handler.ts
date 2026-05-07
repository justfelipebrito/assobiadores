import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { calculateRank, getDailyHighlightPlacementPoints } from '../domain/ranking';
import { buildSeasonRankingIncrement, getSeasonRankingPath } from '../domain/season-ranking';

type DailyHighlightForFinalization = {
  ref: FirebaseFirestore.DocumentReference;
  id: string;
  userId?: unknown;
  category?: unknown;
  voteCount?: number;
  createdAt?: unknown;
};

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

function timestampMillis(value: any) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  return 0;
}

function getNestedSeasonPoints(user: Record<string, any>, seasonId: string, category: string) {
  return {
    seasonPoints: user.seasonPoints?.[seasonId]?.points ?? 0,
    seasonCategoryPoints: user.seasonCategoryPoints?.[seasonId]?.[category]?.points ?? 0,
  };
}

function cleanIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildPointActivityId({
  userId,
  reason,
  sourceType,
  sourceId,
}: {
  userId: string;
  reason: string;
  sourceType: string;
  sourceId: string;
}) {
  return [sourceType, sourceId, reason, userId].map((part) => cleanIdPart(part)).join('__');
}

function buildPlacementPointUpdate({
  user,
  seasonId,
  category,
  points,
}: {
  user: Record<string, any>;
  seasonId: string;
  category: string;
  points: number;
}) {
  const currentPoints = typeof user.points === 'number' ? user.points : 0;
  const nested = getNestedSeasonPoints(user, seasonId, category);

  return {
    points: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    rank: calculateRank(currentPoints + points),
    [`seasonPoints.${seasonId}.points`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.xp`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.rank`]: calculateRank(nested.seasonPoints + points),
    [`seasonPoints.${seasonId}.updatedAt`]: FieldValue.serverTimestamp(),
    [`seasonCategoryPoints.${seasonId}.${category}.points`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.xp`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.rank`]: calculateRank(
      nested.seasonCategoryPoints + points,
    ),
    [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function finalizeDailyHighlightsForDay(
  db: Firestore,
  { dayKey = getBrazilDayKey() }: { dayKey?: string } = {},
) {
  const highlightsSnapshot = await db
    .collection('dailyHighlights')
    .where('dayKey', '==', dayKey)
    .where('status', '==', 'active')
    .get();

  const highlights: DailyHighlightForFinalization[] = highlightsSnapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    ...doc.data(),
  }));
  if (highlights.length === 0) {
    return { dayKey, finalized: 0, winners: [] };
  }

  const sorted = highlights.sort((a, b) => {
    const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
    if (voteDiff !== 0) return voteDiff;
    return timestampMillis(a.createdAt) - timestampMillis(b.createdAt);
  });
  const winners = sorted.slice(0, 3).map((highlight, index) => ({
    highlight,
    place: index + 1,
    points: getDailyHighlightPlacementPoints(index + 1),
  }));
  const winnerById = new Map(winners.map((winner) => [winner.highlight.id, winner]));
  const batch = db.batch();
  const seasonId = dayKey.slice(0, 4);

  for (const highlight of sorted) {
    const winner = winnerById.get(highlight.id);
    batch.update(highlight.ref, {
      status: 'finalized',
      placement: winner?.place ?? null,
      placementPointsAwarded: winner?.points ?? 0,
      voteClosedAt: FieldValue.serverTimestamp(),
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (winner && typeof highlight.userId === 'string' && typeof highlight.category === 'string') {
      const userRef = db.collection('users').doc(highlight.userId);
      const userDoc = await userRef.get();
      const user = userDoc.data() ?? {};
      const activityId = buildPointActivityId({
        userId: highlight.userId,
        reason: 'daily_highlight_placement',
        sourceType: 'daily_highlight',
        sourceId: highlight.id,
      });
      batch.update(
        userRef,
        buildPlacementPointUpdate({
          user,
          seasonId,
          category: highlight.category,
          points: winner.points,
        }),
      );
      batch.set(
        db.doc(getSeasonRankingPath(seasonId, highlight.userId)),
        buildSeasonRankingIncrement({
          user,
          seasonId,
          category: highlight.category,
          points: winner.points,
        }),
        { merge: true },
      );
      batch.set(db.collection('pointActivities').doc(activityId), {
        id: activityId,
        userId: highlight.userId,
        points: winner.points,
        reason: 'daily_highlight_placement',
        label: `Top ${winner.place} em Destaques Diarios`,
        sourceType: 'daily_highlight',
        sourceId: highlight.id,
        sourceTitle: 'Destaques Diarios',
        category: highlight.category,
        seasonId,
        occurredAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  const result = {
    dayKey,
    finalized: sorted.length,
    winners: winners.map(({ highlight, place, points }) => ({
      dailyHighlightId: highlight.id,
      userId: highlight.userId,
      place,
      points,
    })),
  };
  logger.info(`Finalized ${sorted.length} daily highlights for ${dayKey}`);

  return result;
}
