import { z } from 'zod';
import { timestampSchema } from './common';
import { competitionCategorySchema } from './competition-category';

export const videoPlatformSchema = z.enum(['youtube', 'instagram', 'tiktok', 'other']);
export type VideoPlatform = z.infer<typeof videoPlatformSchema>;
export const submissionMediaTypeSchema = z.enum(['audio']);
export type SubmissionMediaType = z.infer<typeof submissionMediaTypeSchema>;

export const submissionStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'removed',
]);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const submissionSchema = z.object({
  id: z.string(),
  battleId: z.string(),
  userId: z.string(),
  userDisplayName: z.string().optional(),
  entryId: z.string(),
  category: competitionCategorySchema.default('freestyle'),
  mediaType: submissionMediaTypeSchema.default('audio'),
  mediaURL: z.string().url(),
  mediaPath: z.string().nullable().default(null),
  mediaContentType: z.string().nullable().default(null),
  mediaOriginalURL: z.string().url().optional(),
  mediaOriginalPath: z.string().nullable().default(null),
  mediaOriginalContentType: z.string().nullable().default(null),
  mediaOriginalSizeBytes: z.number().int().nonnegative().nullable().default(null),
  mediaDurationSeconds: z.number().nonnegative().nullable().default(null),
  mediaSizeBytes: z.number().int().nonnegative().nullable().default(null),
  videoURL: z.string().url().optional(),
  videoPlatform: videoPlatformSchema.default('other'),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  status: submissionStatusSchema.default('approved'),
  moderationNote: z.string().nullable().default(null),
  voteCount: z.number().int().nonnegative().default(0),
  reportCount: z.number().int().nonnegative().default(0),
  removedAt: timestampSchema.nullable().default(null),
  removedBy: z.string().nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Submission = z.infer<typeof submissionSchema>;

export const submissionReportStatusSchema = z.enum(['open', 'reviewed', 'dismissed']);
export type SubmissionReportStatus = z.infer<typeof submissionReportStatusSchema>;

export const submissionReportReasonSchema = z.enum([
  'spam',
  'offensive',
  'copyright',
  'invalid_media',
  'platform_rules',
  'other',
]);
export type SubmissionReportReason = z.infer<typeof submissionReportReasonSchema>;

export const submissionReportSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  battleId: z.string(),
  reporterId: z.string(),
  reportedUserId: z.string(),
  reason: submissionReportReasonSchema,
  description: z.string().max(500).default(''),
  status: submissionReportStatusSchema.default('open'),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  reviewedAt: timestampSchema.nullable().default(null),
  reviewedBy: z.string().nullable().default(null),
});
export type SubmissionReport = z.infer<typeof submissionReportSchema>;

export const createSubmissionSchema = z.object({
  battleId: z.string(),
  entryId: z.string(),
  category: competitionCategorySchema.default('freestyle'),
  mediaType: submissionMediaTypeSchema.default('audio'),
  mediaURL: z.string().url(),
  mediaPath: z.string(),
  mediaContentType: z.string(),
  mediaOriginalURL: z.string().url().optional(),
  mediaOriginalPath: z.string().optional(),
  mediaOriginalContentType: z.string().optional(),
  mediaOriginalSizeBytes: z.number().int().positive().optional(),
  mediaDurationSeconds: z.number().positive().max(120),
  mediaSizeBytes: z.number().int().positive(),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
