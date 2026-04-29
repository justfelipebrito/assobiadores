import { z } from 'zod';
import { timestampSchema } from './common';

export const voterTypeSchema = z.enum(['public', 'judge']);
export type VoterType = z.infer<typeof voterTypeSchema>;

export const voteSchema = z.object({
  id: z.string(),
  battleId: z.string(),
  submissionId: z.string(),
  voterId: z.string(),
  voterType: voterTypeSchema.default('public'),
  weight: z.number().int().positive().default(1),
  createdAt: timestampSchema,
});
export type Vote = z.infer<typeof voteSchema>;
