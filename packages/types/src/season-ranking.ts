import { z } from 'zod';
import { competitionCategorySchema } from './competition-category';
import { brazilStateSchema } from './user';
import { timestampSchema } from './common';

export const seasonRankingCategoryBreakdownSchema = z.record(
  competitionCategorySchema,
  z.number().int().nonnegative(),
);

export const seasonRankingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  seasonId: z.string(),
  displayName: z.string().min(1).max(100),
  username: z.string().min(3).max(30).nullable().default(null),
  state: brazilStateSchema.nullable().default(null),
  birthState: brazilStateSchema.nullable().default(null),
  totalPoints: z.number().int().nonnegative().default(0),
  xp: z.number().int().nonnegative().default(0),
  rank: z.string().default('Iniciante'),
  byCategory: seasonRankingCategoryBreakdownSchema.default({}),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type SeasonRanking = z.infer<typeof seasonRankingSchema>;
