import { z } from 'zod';
import { timestampSchema } from './common';
import { brazilStateSchema } from './user';

// ── Season ────────────────────────────────────────────────────────────────────

export const seasonStatusSchema = z.enum(['upcoming', 'active', 'archived']);
export type SeasonStatus = z.infer<typeof seasonStatusSchema>;

export const seasonScopeSchema = z.enum(['national', 'regional']);
export type SeasonScope = z.infer<typeof seasonScopeSchema>;

export const seasonSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),    // e.g. "Temporada 1 — 2026"
  slug: z.string().min(1).max(50),     // e.g. "2026-s1"
  scope: seasonScopeSchema,
  region: brazilStateSchema.nullable().default(null),
  status: seasonStatusSchema.default('upcoming'),
  start: timestampSchema,
  end: timestampSchema,
  championshipIds: z.array(z.string()).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Season = z.infer<typeof seasonSchema>;

// ── Championship ──────────────────────────────────────────────────────────────

export const championshipStatusSchema = z.enum([
  'upcoming',
  'registration',
  'active',
  'finished',
]);
export type ChampionshipStatus = z.infer<typeof championshipStatusSchema>;

export const championshipScopeSchema = z.enum(['national', 'regional']);
export type ChampionshipScope = z.infer<typeof championshipScopeSchema>;

export const championshipScheduleSchema = z.object({
  registrationStart: timestampSchema,
  registrationEnd: timestampSchema,
  start: timestampSchema,
  end: timestampSchema,
});

export const championshipSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  seasonId: z.string().nullable().default(null),
  scope: championshipScopeSchema,
  region: brazilStateSchema.nullable().default(null),
  status: championshipStatusSchema.default('upcoming'),
  schedule: championshipScheduleSchema,
  maxParticipants: z.number().int().nonnegative().default(0),
  currentParticipants: z.number().int().nonnegative().default(0),
  qualifierBattleIds: z.array(z.string()).default([]),
  prizePool: z.number().int().nonnegative().default(0),
  prizeDistribution: z
    .object({ first: z.number(), second: z.number(), third: z.number() })
    .nullable()
    .default(null),
  createdBy: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Championship = z.infer<typeof championshipSchema>;

// ── Stage ─────────────────────────────────────────────────────────────────────

export const stageTypeSchema = z.enum(['group', 'knockout']);
export type StageType = z.infer<typeof stageTypeSchema>;

export const stageStatusSchema = z.enum(['pending', 'active', 'finished']);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const stageNameSchema = z.enum([
  'Fase de Grupos',
  'Rodada de 32',
  'Rodada de 16',
  'Quartas de Final',
  'Semifinal',
  'Final',
]);
export type StageName = z.infer<typeof stageNameSchema>;

export const stageSchema = z.object({
  id: z.string(),
  championshipId: z.string(),
  name: stageNameSchema,
  type: stageTypeSchema,
  order: z.number().int().nonnegative(),
  status: stageStatusSchema.default('pending'),
  participantIds: z.array(z.string()).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Stage = z.infer<typeof stageSchema>;

// ── Match ─────────────────────────────────────────────────────────────────────

export const matchStatusSchema = z.enum(['scheduled', 'active', 'voting', 'finished']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchSchema = z.object({
  id: z.string(),
  championshipId: z.string(),
  stageId: z.string(),
  participantIds: z.array(z.string()).min(2),
  battleId: z.string().nullable().default(null),
  scheduledAt: timestampSchema,
  status: matchStatusSchema.default('scheduled'),
  winnerId: z.string().nullable().default(null),
  scores: z.record(z.string(), z.number()).default({}),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Match = z.infer<typeof matchSchema>;
