import { z } from 'zod';
import { timestampSchema } from './common';

export const DAILY_HIGHLIGHT_SUBMISSION_POINTS = 10;

export const dailyHighlightStatusSchema = z.enum(['active', 'hidden']);
export type DailyHighlightStatus = z.infer<typeof dailyHighlightStatusSchema>;

export const dailyHighlightSchema = z.object({
  id: z.string(),
  dayKey: z.string(),
  userId: z.string(),
  userDisplayName: z.string(),
  videoURL: z.string().url(),
  videoPlatform: z.enum(['youtube', 'instagram', 'tiktok', 'other']),
  status: dailyHighlightStatusSchema.default('active'),
  voteCount: z.number().int().nonnegative().default(0),
  pointsAwarded: z.number().int().nonnegative().default(DAILY_HIGHLIGHT_SUBMISSION_POINTS),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type DailyHighlight = z.infer<typeof dailyHighlightSchema>;

export const dailyHighlightLikeSchema = z.object({
  id: z.string(),
  dailyHighlightId: z.string(),
  userId: z.string(),
  createdAt: timestampSchema,
});
export type DailyHighlightLike = z.infer<typeof dailyHighlightLikeSchema>;
