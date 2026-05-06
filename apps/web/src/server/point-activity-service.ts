import { FieldValue } from 'firebase-admin/firestore';
import type { CompetitionCategory, PointActivityReason, PointActivitySourceType } from '@batalha/types';

export interface BuildPointActivityInput {
  userId: string;
  points: number;
  reason: PointActivityReason;
  label: string;
  sourceType: PointActivitySourceType;
  sourceId: string;
  sourceTitle?: string | null;
  category?: CompetitionCategory | null;
  seasonId: string;
}

function cleanIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildPointActivityId({
  userId,
  reason,
  sourceType,
  sourceId,
}: Pick<BuildPointActivityInput, 'userId' | 'reason' | 'sourceType' | 'sourceId'>) {
  return [sourceType, sourceId, reason, userId].map((part) => cleanIdPart(part)).join('__');
}

export function buildPointActivity(input: BuildPointActivityInput) {
  const id = buildPointActivityId(input);

  return {
    id,
    userId: input.userId,
    points: input.points,
    reason: input.reason,
    label: input.label,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle ?? null,
    category: input.category ?? null,
    seasonId: input.seasonId,
    occurredAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}
