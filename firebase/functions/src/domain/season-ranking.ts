import { FieldValue } from 'firebase-admin/firestore';
import { calculateRank } from './ranking';

type UserSnapshot = {
  displayName?: unknown;
  username?: unknown;
  state?: unknown;
  birthState?: unknown;
  seasonPoints?: Record<string, { points?: number }>;
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

export function buildSeasonRankingIncrement({
  user,
  seasonId,
  category,
  points,
}: {
  user: UserSnapshot;
  seasonId: string;
  category: string;
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
