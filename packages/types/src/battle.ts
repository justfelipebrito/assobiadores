import { z } from 'zod';
import { timestampSchema } from './common';

export const battleTypeSchema = z.enum(['official', 'community']);
export type BattleType = z.infer<typeof battleTypeSchema>;

export const battleStatusSchema = z.enum([
  'draft',
  'registration',
  'active',
  'voting',
  'finished',
]);
export type BattleStatus = z.infer<typeof battleStatusSchema>;

export const battleCategorySchema = z.enum(['classico', 'imitacao', 'freestyle', 'melodia']);
export type BattleCategory = z.infer<typeof battleCategorySchema>;

export const votingTypeSchema = z.enum(['public', 'judge', 'hybrid']);
export type VotingType = z.infer<typeof votingTypeSchema>;

export const prizeDistributionSchema = z.object({
  first: z.number().int().nonnegative(),
  second: z.number().int().nonnegative(),
  third: z.number().int().nonnegative(),
});
export type PrizeDistribution = z.infer<typeof prizeDistributionSchema>;

export const battleWinnerSchema = z.object({
  userId: z.string(),
  place: z.number().int().min(1).max(3),
  points: z.number().int().nonnegative(),
  prize: z.number().int().nonnegative(),
});
export type BattleWinner = z.infer<typeof battleWinnerSchema>;

export const battleSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  type: battleTypeSchema,
  category: battleCategorySchema,
  status: battleStatusSchema.default('draft'),
  entryFee: z.number().int().nonnegative().default(0),
  prizePool: z.number().int().nonnegative().default(0),
  prizeDistribution: prizeDistributionSchema.nullable().default(null),
  votingType: votingTypeSchema.default('public'),
  maxParticipants: z.number().int().nonnegative().default(0),
  currentParticipants: z.number().int().nonnegative().default(0),
  registrationStart: timestampSchema,
  registrationEnd: timestampSchema,
  submissionDeadline: timestampSchema,
  votingStart: timestampSchema,
  votingEnd: timestampSchema,
  rules: z.array(z.string()).default([]),
  judges: z.array(z.string()).default([]),
  winners: z.array(battleWinnerSchema).default([]),
  createdBy: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Battle = z.infer<typeof battleSchema>;

export const createBattleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  type: battleTypeSchema,
  category: battleCategorySchema,
  entryFee: z.number().int().nonnegative().default(0),
  prizePool: z.number().int().nonnegative().default(0),
  prizeDistribution: prizeDistributionSchema.nullable().default(null),
  votingType: votingTypeSchema.default('public'),
  maxParticipants: z.number().int().nonnegative().default(0),
  registrationStart: timestampSchema,
  registrationEnd: timestampSchema,
  submissionDeadline: timestampSchema,
  votingStart: timestampSchema,
  votingEnd: timestampSchema,
  rules: z.array(z.string()).default([]),
  judges: z.array(z.string()).default([]),
});
export type CreateBattleInput = z.infer<typeof createBattleSchema>;

export const battleEntryStatusSchema = z.enum(['pending_payment', 'confirmed', 'disqualified']);
export type BattleEntryStatus = z.infer<typeof battleEntryStatusSchema>;

export const battleEntrySchema = z.object({
  id: z.string(),
  battleId: z.string(),
  userId: z.string(),
  paymentId: z.string().nullable().default(null),
  status: battleEntryStatusSchema.default('pending_payment'),
  createdAt: timestampSchema,
});
export type BattleEntry = z.infer<typeof battleEntrySchema>;
