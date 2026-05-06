import { z } from 'zod';
import { timestampSchema } from './common';
import { competitionCategorySchema } from './competition-category';

export const pointActivityReasonSchema = z.enum([
  'battle_win',
  'daily_highlight_submission',
  'daily_highlight_placement',
  'qualifier_entry',
  'qualifier_phase_advance',
  'qualifier_regional_qualification',
  'championship_phase_advance',
  'championship_placement',
]);
export type PointActivityReason = z.infer<typeof pointActivityReasonSchema>;

export const pointActivitySourceTypeSchema = z.enum([
  'battle',
  'daily_highlight',
  'qualifier',
  'championship',
]);
export type PointActivitySourceType = z.infer<typeof pointActivitySourceTypeSchema>;

export const pointActivitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  points: z.number().int().positive(),
  reason: pointActivityReasonSchema,
  label: z.string().min(1).max(120),
  sourceType: pointActivitySourceTypeSchema,
  sourceId: z.string(),
  sourceTitle: z.string().max(200).nullable().default(null),
  category: competitionCategorySchema.nullable().default(null),
  seasonId: z.string(),
  occurredAt: timestampSchema,
  createdAt: timestampSchema,
});
export type PointActivity = z.infer<typeof pointActivitySchema>;
