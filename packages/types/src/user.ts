import { z } from 'zod';
import { timestampSchema } from './common';

export const userRoleSchema = z.enum(['user', 'admin', 'judge']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatsSchema = z.object({
  battlesEntered: z.number().int().nonnegative(),
  battlesWon: z.number().int().nonnegative(),
  totalVotesReceived: z.number().int().nonnegative(),
  topThreeFinishes: z.number().int().nonnegative(),
});
export type UserStats = z.infer<typeof userStatsSchema>;

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  photoURL: z.string().url().nullable(),
  bio: z.string().max(280).default(''),
  role: userRoleSchema.default('user'),
  points: z.number().int().nonnegative().default(0),
  xp: z.number().int().nonnegative().default(0),
  rank: z.string().default('Iniciante'),
  stats: userStatsSchema.default({
    battlesEntered: 0,
    battlesWon: 0,
    totalVotesReceived: 0,
    topThreeFinishes: 0,
  }),
  badges: z.array(z.string()).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(280).optional(),
  photoURL: z.string().url().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
