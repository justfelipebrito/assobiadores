import { z } from 'zod';
import { timestampSchema } from './common';
import { competitionCategorySchema } from './competition-category';
import { brazilStateSchema } from './user';
import { voterTypeSchema } from './vote';

// ── Season ────────────────────────────────────────────────────────────────────

export const seasonStatusSchema = z.enum(['upcoming', 'active', 'archived']);
export type SeasonStatus = z.infer<typeof seasonStatusSchema>;

export const seasonScopeSchema = z.enum(['national', 'regional']);
export type SeasonScope = z.infer<typeof seasonScopeSchema>;

export const seasonSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100), // e.g. "Temporada 2026"
  slug: z.string().min(1).max(50), // e.g. "2026"
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

export const championshipStatusSchema = z.enum(['upcoming', 'registration', 'active', 'finished']);
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
  category: competitionCategorySchema,
  scope: championshipScopeSchema,
  region: brazilStateSchema.nullable().default(null),
  status: championshipStatusSchema.default('upcoming'),
  dateStatus: z.enum(['scheduled', 'to_be_defined']).default('scheduled'),
  schedule: championshipScheduleSchema,
  maxParticipants: z.number().int().nonnegative().default(0),
  currentParticipants: z.number().int().nonnegative().default(0),
  participantIds: z.array(z.string()).default([]),
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

// ── Qualifier Registration ───────────────────────────────────────────────────

export const qualifierRegistrationStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'cancelled',
]);
export type QualifierRegistrationStatus = z.infer<typeof qualifierRegistrationStatusSchema>;

export const qualifierBracketStatusSchema = z.enum([
  'registered',
  'waiting_draw',
  'active',
  'eliminated',
  'qualified',
]);
export type QualifierBracketStatus = z.infer<typeof qualifierBracketStatusSchema>;

export const qualifierRegistrationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  seasonId: z.string(),
  category: competitionCategorySchema,
  region: brazilStateSchema,
  status: qualifierRegistrationStatusSchema.default('pending_payment'),
  bracketStatus: qualifierBracketStatusSchema.default('registered'),
  currentRound: z.number().int().nonnegative().default(0),
  currentMatchId: z.string().nullable().default(null),
  matchIds: z.array(z.string()).default([]),
  qualifiedChampionshipId: z.string().nullable().default(null),
  entryFeeCents: z.number().int().nonnegative().default(400),
  platformFeePercent: z.number().nonnegative().default(20),
  prizePoolPercent: z.number().nonnegative().default(80),
  paymentId: z.string().nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type QualifierRegistration = z.infer<typeof qualifierRegistrationSchema>;

// ── Qualifier Match ──────────────────────────────────────────────────────────

export const qualifierMatchStatusSchema = z.enum([
  'scheduled',
  'submissions_open',
  'voting',
  'finished',
  'walkover',
  'cancelled',
]);
export type QualifierMatchStatus = z.infer<typeof qualifierMatchStatusSchema>;

export const qualifierMatchSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  category: competitionCategorySchema,
  region: brazilStateSchema,
  roundNumber: z.number().int().positive(),
  roundLabel: z.string().min(1).max(80),
  matchDayIndex: z.number().int().positive().default(1),
  sequenceInDay: z.number().int().positive().default(1),
  participantIds: z.array(z.string()).min(2).max(2),
  registrationIds: z.array(z.string()).min(2).max(2),
  status: qualifierMatchStatusSchema.default('scheduled'),
  scheduledFor: timestampSchema,
  submissionDeadline: timestampSchema,
  votingStart: timestampSchema,
  votingEnd: timestampSchema,
  submissionIds: z.record(z.string(), z.string()).default({}),
  publicVoteCounts: z.record(z.string(), z.number()).default({}),
  winnerId: z.string().nullable().default(null),
  walkoverWinnerId: z.string().nullable().default(null),
  disqualifiedUserIds: z.array(z.string()).default([]),
  nextMatchId: z.string().nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type QualifierMatch = z.infer<typeof qualifierMatchSchema>;

// ── Qualifier Submission ─────────────────────────────────────────────────────

export const qualifierSubmissionStatusSchema = z.enum(['submitted', 'disqualified']);
export type QualifierSubmissionStatus = z.infer<typeof qualifierSubmissionStatusSchema>;

export const qualifierSubmissionSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  registrationId: z.string(),
  seasonId: z.string(),
  category: competitionCategorySchema,
  region: brazilStateSchema,
  roundNumber: z.number().int().positive(),
  userId: z.string(),
  userDisplayName: z.string().min(1).max(120),
  mediaType: z.literal('audio'),
  mediaURL: z.string().url(),
  mediaPath: z.string().min(1),
  mediaContentType: z.string().min(1),
  mediaDurationSeconds: z.number().int().positive(),
  mediaSizeBytes: z.number().int().positive(),
  status: qualifierSubmissionStatusSchema.default('submitted'),
  publicVoteCount: z.number().int().nonnegative().default(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type QualifierSubmission = z.infer<typeof qualifierSubmissionSchema>;

export const qualifierVoteSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  submissionId: z.string(),
  votedUserId: z.string(),
  voterId: z.string(),
  voterType: voterTypeSchema.default('public'),
  weight: z.number().int().positive().default(1),
  createdAt: timestampSchema,
});
export type QualifierVote = z.infer<typeof qualifierVoteSchema>;

// ── Qualifier Track ──────────────────────────────────────────────────────────

export const qualifierTrackStatusSchema = z.enum([
  'registration_open',
  'draw_pending',
  'active',
  'finished',
]);
export type QualifierTrackStatus = z.infer<typeof qualifierTrackStatusSchema>;

export const qualifierTrackSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(80),
  seasonId: z.string(),
  seasonYear: z.number().int().positive(),
  category: competitionCategorySchema,
  region: brazilStateSchema,
  status: qualifierTrackStatusSchema.default('registration_open'),
  entryFeeCents: z.number().int().nonnegative().default(400),
  registrationDeadline: timestampSchema,
  bracketStart: timestampSchema,
  bracketEnd: timestampSchema,
  maxQualified: z.number().int().positive().default(64),
  dailyMatchLimit: z.number().int().positive().default(5),
  plannedMatchDays: z.number().int().nonnegative().default(0),
  plannedMatchCount: z.number().int().nonnegative().default(0),
  currentRound: z.number().int().nonnegative().default(0),
  registeredCount: z.number().int().nonnegative().default(0),
  confirmedCount: z.number().int().nonnegative().default(0),
  pendingPaymentCount: z.number().int().nonnegative().default(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type QualifierTrack = z.infer<typeof qualifierTrackSchema>;
