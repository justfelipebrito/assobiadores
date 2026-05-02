import { z } from 'zod';
import { timestampSchema } from './common';

export const userRoleSchema = z.enum(['user', 'admin', 'judge']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const accountTypeSchema = z.enum(['free', 'subscriber', 'admin', 'judge']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const userPlanSchema = z.enum(['free', 'pro', 'organization']);
export type UserPlan = z.infer<typeof userPlanSchema>;

export const brazilStateSchema = z.enum([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);
export type BrazilState = z.infer<typeof brazilStateSchema>;

export const officialProfileSchema = z.object({
  eligible: z.boolean().default(false),
  verified: z.boolean().default(false),
  state: brazilStateSchema.nullable().default(null),
  region: z.string().nullable().default(null),
});
export type OfficialProfile = z.infer<typeof officialProfileSchema>;

export const userStatsSchema = z.object({
  battlesEntered: z.number().int().nonnegative(),
  battlesWon: z.number().int().nonnegative(),
  totalVotesReceived: z.number().int().nonnegative(),
  topThreeFinishes: z.number().int().nonnegative(),
});
export type UserStats = z.infer<typeof userStatsSchema>;

export const seasonPointsEntrySchema = z.object({
  points: z.number().int().nonnegative().default(0),
  xp: z.number().int().nonnegative().default(0),
  rank: z.string().default('Iniciante'),
  updatedAt: timestampSchema.optional(),
});
export type SeasonPointsEntry = z.infer<typeof seasonPointsEntrySchema>;

export const userSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().positive().default(1),
  username: z.string().min(3).max(30),
  usernameLower: z.string().min(3).max(30),
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  photoURL: z.string().url().nullable(),
  bio: z.string().max(280).default(''),
  role: userRoleSchema.default('user'),
  accountType: accountTypeSchema.default('free'),
  plan: userPlanSchema.default('free'),
  state: brazilStateSchema.nullable().default(null),
  city: z.string().max(100).nullable().default(null),
  country: z.literal('BR').default('BR'),
  officialProfile: officialProfileSchema.default({
    eligible: false,
    verified: false,
    state: null,
    region: null,
  }),
  points: z.number().int().nonnegative().default(0),
  xp: z.number().int().nonnegative().default(0),
  rank: z.string().default('Iniciante'),
  seasonPoints: z.record(seasonPointsEntrySchema).default({}),
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
