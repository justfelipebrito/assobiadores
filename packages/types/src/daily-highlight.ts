import { z } from 'zod';
import { timestampSchema } from './common';
import { competitionCategorySchema } from './competition-category';
import { brazilStateSchema } from './user';
import { SEASON_SCORING } from './season-scoring';

export const DAILY_HIGHLIGHT_SUBMISSION_POINTS = SEASON_SCORING.dailyHighlight.submission;
export const DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS = 120;
export const DAILY_HIGHLIGHT_MAX_AUDIO_BYTES = 2.5 * 1024 * 1024;

export const dailyHighlightStatusSchema = z.enum(['active', 'finalized', 'hidden']);
export type DailyHighlightStatus = z.infer<typeof dailyHighlightStatusSchema>;
export const dailyHighlightMediaTypeSchema = z.enum(['audio']);
export type DailyHighlightMediaType = z.infer<typeof dailyHighlightMediaTypeSchema>;

export const dailyHighlightSchema = z.object({
  id: z.string(),
  dayKey: z.string(),
  userId: z.string(),
  userDisplayName: z.string(),
  userBirthState: brazilStateSchema.nullable().default(null),
  category: competitionCategorySchema.default('freestyle'),
  mediaType: dailyHighlightMediaTypeSchema.default('audio'),
  mediaURL: z.string().url().optional(),
  mediaPath: z.string().nullable().default(null),
  mediaContentType: z.string().nullable().default(null),
  mediaOriginalURL: z.string().url().optional(),
  mediaOriginalPath: z.string().nullable().default(null),
  mediaOriginalContentType: z.string().nullable().default(null),
  mediaOriginalSizeBytes: z.number().int().nonnegative().nullable().default(null),
  mediaDurationSeconds: z.number().nonnegative().nullable().default(null),
  mediaSizeBytes: z.number().int().nonnegative().nullable().default(null),
  videoURL: z.string().url(),
  videoPlatform: z.enum(['youtube', 'instagram', 'tiktok', 'other']),
  status: dailyHighlightStatusSchema.default('active'),
  voteCount: z.number().int().nonnegative().default(0),
  placement: z.number().int().positive().max(3).nullable().default(null),
  placementPointsAwarded: z.number().int().nonnegative().default(0),
  voteClosedAt: timestampSchema.nullable().optional(),
  finalizedAt: timestampSchema.nullable().optional(),
  pointsAwarded: z.number().int().nonnegative().default(DAILY_HIGHLIGHT_SUBMISSION_POINTS),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type DailyHighlight = z.infer<typeof dailyHighlightSchema>;

export const dailyHighlightLikeSchema = z.object({
  id: z.string(),
  dayKey: z.string(),
  dailyHighlightId: z.string(),
  userId: z.string(),
  createdAt: timestampSchema,
});
export type DailyHighlightLike = z.infer<typeof dailyHighlightLikeSchema>;
