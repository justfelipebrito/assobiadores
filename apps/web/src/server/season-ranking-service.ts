import { FieldValue, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';
import type { CompetitionCategory } from '@batalha/types';
import { calculateRank } from '@batalha/utils';

export const DEFAULT_SEASON_ID = '2026';

type UserSnapshot = {
  displayName?: unknown;
  username?: unknown;
  state?: unknown;
  birthState?: unknown;
  seasonPoints?: Record<string, { points?: number }>;
  seasonCategoryPoints?: Record<string, Record<string, { points?: number }>>;
};

function cleanDisplayName(user: UserSnapshot) {
  return typeof user.displayName === 'string' && user.displayName.trim()
    ? user.displayName.trim()
    : 'Assobiador';
}

function cleanUsername(user: UserSnapshot) {
  return typeof user.username === 'string' && user.username.trim() ? user.username.trim() : null;
}

function cleanState(value: unknown) {
  return typeof value === 'string' && value.length === 2 ? value : null;
}

export function getSeasonRankingPath(seasonId: string, userId: string) {
  return `seasonRankings/${seasonId}/users/${userId}`;
}

export function buildInitialSeasonRanking({
  userId,
  seasonId = DEFAULT_SEASON_ID,
  user,
}: {
  userId: string;
  seasonId?: string;
  user: UserSnapshot;
}) {
  return {
    id: userId,
    userId,
    seasonId,
    displayName: cleanDisplayName(user),
    username: cleanUsername(user),
    state: cleanState(user.state),
    birthState: cleanState(user.birthState),
    totalPoints: user.seasonPoints?.[seasonId]?.points ?? 0,
    xp: user.seasonPoints?.[seasonId]?.points ?? 0,
    rank: calculateRank(user.seasonPoints?.[seasonId]?.points ?? 0),
    byCategory: Object.fromEntries(
      Object.entries(user.seasonCategoryPoints?.[seasonId] ?? {}).map(([category, entry]) => [
        category,
        entry.points ?? 0,
      ]),
    ),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export function setInitialSeasonRanking({
  batch,
  rankingRef,
  userId,
  seasonId = DEFAULT_SEASON_ID,
  user,
}: {
  batch: Pick<WriteBatch, 'set'>;
  rankingRef: DocumentReference;
  userId: string;
  seasonId?: string;
  user: UserSnapshot;
}) {
  batch.set(rankingRef, buildInitialSeasonRanking({ userId, seasonId, user }), { merge: true });
}

export function buildSeasonRankingIncrement({
  user,
  seasonId,
  category,
  points,
}: {
  user: UserSnapshot;
  seasonId: string;
  category: CompetitionCategory | string;
  points: number;
}) {
  const currentSeasonPoints = user.seasonPoints?.[seasonId]?.points ?? 0;
  return {
    displayName: cleanDisplayName(user),
    username: cleanUsername(user),
    state: cleanState(user.state),
    birthState: cleanState(user.birthState),
    totalPoints: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    rank: calculateRank(currentSeasonPoints + points),
    [`byCategory.${category}`]: FieldValue.increment(points),
    updatedAt: FieldValue.serverTimestamp(),
  };
}
