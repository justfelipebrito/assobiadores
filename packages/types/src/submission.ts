import { z } from 'zod';
import { timestampSchema } from './common';

export const videoPlatformSchema = z.enum(['youtube', 'instagram', 'tiktok', 'other']);
export type VideoPlatform = z.infer<typeof videoPlatformSchema>;

export const submissionStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected']);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const submissionSchema = z.object({
  id: z.string(),
  battleId: z.string(),
  userId: z.string(),
  entryId: z.string(),
  videoURL: z.string().url(),
  videoPlatform: videoPlatformSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  status: submissionStatusSchema.default('submitted'),
  moderationNote: z.string().nullable().default(null),
  voteCount: z.number().int().nonnegative().default(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Submission = z.infer<typeof submissionSchema>;

export const createSubmissionSchema = z.object({
  battleId: z.string(),
  entryId: z.string(),
  videoURL: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
