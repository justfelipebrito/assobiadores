import type { CompetitionCategory, QualifierMatch, BrazilState } from '@batalha/types';

export const QUALIFIER_DEFAULT_MAX_QUALIFIED = 64;
export const QUALIFIER_SMALL_TRACK_DAILY_MATCH_LIMIT = 5;
export const QUALIFIER_MEDIUM_TRACK_DAILY_MATCH_LIMIT = 12;
export const QUALIFIER_LARGE_TRACK_DAILY_MATCH_LIMIT = 24;

export interface QualifierEntrant {
  userId: string;
  registrationId: string;
}

export interface QualifierRoundPlan {
  roundNumber: number;
  startingParticipants: number;
  targetParticipants: number;
  matchCount: number;
  byeCount: number;
  dailyMatchLimit: number;
  matchDays: number;
  startsOnDayIndex: number;
  endsOnDayIndex: number;
}

export interface QualifierBracketPlan {
  participantCount: number;
  maxQualified: number;
  qualifiedWithoutMatches: boolean;
  dailyMatchLimit: number;
  totalMatchCount: number;
  totalMatchDays: number;
  rounds: QualifierRoundPlan[];
}

export interface QualifierMatchPlan {
  roundNumber: number;
  roundLabel: string;
  matchDayIndex: number;
  sequenceInDay: number;
  participantIds: [string, string];
  registrationIds: [string, string];
  scheduledFor: Date;
  submissionDeadline: Date;
  votingStart: Date;
  votingEnd: Date;
}

export function getQualifierDailyMatchLimit(participantCount: number) {
  if (participantCount <= 100) return QUALIFIER_SMALL_TRACK_DAILY_MATCH_LIMIT;
  if (participantCount <= 500) return QUALIFIER_MEDIUM_TRACK_DAILY_MATCH_LIMIT;
  return QUALIFIER_LARGE_TRACK_DAILY_MATCH_LIMIT;
}

export function getQualifierTargetCount(participantCount: number, maxQualified = 64) {
  return Math.min(participantCount, maxQualified);
}

export function getNextQualifierRoundTarget(participantCount: number, maxQualified = 64) {
  const target = getQualifierTargetCount(participantCount, maxQualified);
  if (participantCount <= target) return target;

  let nextPower = target;
  while (nextPower * 2 < participantCount) {
    nextPower *= 2;
  }

  return nextPower;
}

export function buildQualifierBracketPlan({
  participantCount,
  maxQualified = QUALIFIER_DEFAULT_MAX_QUALIFIED,
}: {
  participantCount: number;
  maxQualified?: number;
}): QualifierBracketPlan {
  const safeParticipantCount = Math.max(0, Math.floor(participantCount));
  const safeMaxQualified = Math.max(1, Math.floor(maxQualified));
  const dailyMatchLimit = getQualifierDailyMatchLimit(safeParticipantCount);
  const rounds: QualifierRoundPlan[] = [];

  let currentParticipants = safeParticipantCount;
  let roundNumber = 1;
  let startsOnDayIndex = 1;

  while (currentParticipants > safeMaxQualified) {
    const targetParticipants = getNextQualifierRoundTarget(currentParticipants, safeMaxQualified);
    const matchCount = currentParticipants - targetParticipants;
    const byeCount = currentParticipants - matchCount * 2;
    const matchDays = Math.ceil(matchCount / dailyMatchLimit);
    const endsOnDayIndex = startsOnDayIndex + matchDays - 1;

    rounds.push({
      roundNumber,
      startingParticipants: currentParticipants,
      targetParticipants,
      matchCount,
      byeCount,
      dailyMatchLimit,
      matchDays,
      startsOnDayIndex,
      endsOnDayIndex,
    });

    currentParticipants = targetParticipants;
    roundNumber += 1;
    startsOnDayIndex = endsOnDayIndex + 1;
  }

  return {
    participantCount: safeParticipantCount,
    maxQualified: safeMaxQualified,
    qualifiedWithoutMatches: safeParticipantCount <= safeMaxQualified,
    dailyMatchLimit,
    totalMatchCount: rounds.reduce((total, round) => total + round.matchCount, 0),
    totalMatchDays: rounds.reduce((total, round) => total + round.matchDays, 0),
    rounds,
  };
}

export function buildInitialQualifierMatchPlans({
  entrants,
  seasonId,
  category,
  region,
  startsAt,
  maxQualified = QUALIFIER_DEFAULT_MAX_QUALIFIED,
  rng = Math.random,
}: {
  entrants: QualifierEntrant[];
  seasonId: string;
  category: CompetitionCategory;
  region: BrazilState;
  startsAt: Date;
  maxQualified?: number;
  rng?: () => number;
}) {
  const bracketPlan = buildQualifierBracketPlan({
    participantCount: entrants.length,
    maxQualified,
  });
  const firstRound = bracketPlan.rounds[0];

  if (!firstRound) {
    return {
      bracketPlan,
      matchPlans: [] as QualifierMatchPlan[],
      byeEntrants: [...entrants],
      matchDocs: [] as Array<Omit<QualifierMatch, 'id' | 'createdAt' | 'updatedAt'>>,
    };
  }

  const shuffledEntrants = shuffleEntrants(entrants, rng);
  const pairedEntrants = shuffledEntrants.slice(0, firstRound.matchCount * 2);
  const byeEntrants = shuffledEntrants.slice(firstRound.matchCount * 2);
  const matchPlans: QualifierMatchPlan[] = [];

  for (let index = 0; index < firstRound.matchCount; index += 1) {
    const first = pairedEntrants[index * 2]!;
    const second = pairedEntrants[index * 2 + 1]!;
    const matchDayIndex = Math.floor(index / firstRound.dailyMatchLimit) + 1;
    const sequenceInDay = (index % firstRound.dailyMatchLimit) + 1;
    const dates = getQualifierMatchDates(startsAt, matchDayIndex);

    matchPlans.push({
      roundNumber: 1,
      roundLabel: 'Rodada 1',
      matchDayIndex,
      sequenceInDay,
      participantIds: [first.userId, second.userId],
      registrationIds: [first.registrationId, second.registrationId],
      ...dates,
    });
  }

  return {
    bracketPlan,
    matchPlans,
    byeEntrants,
    matchDocs: matchPlans.map((matchPlan) => ({
      seasonId,
      category,
      region,
      roundNumber: matchPlan.roundNumber,
      roundLabel: matchPlan.roundLabel,
      matchDayIndex: matchPlan.matchDayIndex,
      sequenceInDay: matchPlan.sequenceInDay,
      participantIds: matchPlan.participantIds,
      registrationIds: matchPlan.registrationIds,
      status: 'scheduled' as const,
      scheduledFor: matchPlan.scheduledFor,
      submissionDeadline: matchPlan.submissionDeadline,
      votingStart: matchPlan.votingStart,
      votingEnd: matchPlan.votingEnd,
      submissionIds: {},
      publicVoteCounts: {},
      winnerId: null,
      walkoverWinnerId: null,
      disqualifiedUserIds: [],
      nextMatchId: null,
    })),
  };
}

export function buildQualifierRoundMatchPlans({
  entrants,
  roundNumber,
  roundLabel = `Rodada ${roundNumber}`,
  dailyMatchLimit,
  startsOnDayIndex,
  startsAt,
  seasonId,
  category,
  region,
  maxQualified = QUALIFIER_DEFAULT_MAX_QUALIFIED,
  rng = Math.random,
}: {
  entrants: QualifierEntrant[];
  roundNumber: number;
  roundLabel?: string;
  dailyMatchLimit: number;
  startsOnDayIndex: number;
  startsAt: Date;
  seasonId: string;
  category: CompetitionCategory;
  region: BrazilState;
  maxQualified?: number;
  rng?: () => number;
}) {
  const targetParticipants = getNextQualifierRoundTarget(entrants.length, maxQualified);
  const matchCount = Math.max(0, entrants.length - targetParticipants);

  if (matchCount === 0) {
    return {
      matchPlans: [] as QualifierMatchPlan[],
      byeEntrants: [...entrants],
      matchDocs: [] as Array<Omit<QualifierMatch, 'id' | 'createdAt' | 'updatedAt'>>,
    };
  }

  const shuffledEntrants = shuffleEntrants(entrants, rng);
  const pairedEntrants = shuffledEntrants.slice(0, matchCount * 2);
  const byeEntrants = shuffledEntrants.slice(matchCount * 2);
  const matchPlans: QualifierMatchPlan[] = [];

  for (let index = 0; index < matchCount; index += 1) {
    const first = pairedEntrants[index * 2]!;
    const second = pairedEntrants[index * 2 + 1]!;
    const dayOffset = Math.floor(index / dailyMatchLimit);
    const matchDayIndex = startsOnDayIndex + dayOffset;
    const sequenceInDay = (index % dailyMatchLimit) + 1;
    const dates = getQualifierMatchDates(startsAt, matchDayIndex);

    matchPlans.push({
      roundNumber,
      roundLabel,
      matchDayIndex,
      sequenceInDay,
      participantIds: [first.userId, second.userId],
      registrationIds: [first.registrationId, second.registrationId],
      ...dates,
    });
  }

  return {
    matchPlans,
    byeEntrants,
    matchDocs: matchPlans.map((matchPlan) => ({
      seasonId,
      category,
      region,
      roundNumber: matchPlan.roundNumber,
      roundLabel: matchPlan.roundLabel,
      matchDayIndex: matchPlan.matchDayIndex,
      sequenceInDay: matchPlan.sequenceInDay,
      participantIds: matchPlan.participantIds,
      registrationIds: matchPlan.registrationIds,
      status: 'scheduled' as const,
      scheduledFor: matchPlan.scheduledFor,
      submissionDeadline: matchPlan.submissionDeadline,
      votingStart: matchPlan.votingStart,
      votingEnd: matchPlan.votingEnd,
      submissionIds: {},
      publicVoteCounts: {},
      winnerId: null,
      walkoverWinnerId: null,
      disqualifiedUserIds: [],
      nextMatchId: null,
    })),
  };
}

function shuffleEntrants(entrants: QualifierEntrant[], rng: () => number) {
  const shuffled = [...entrants];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function getQualifierMatchDates(startsAt: Date, matchDayIndex: number) {
  const matchDate = addDays(startsAt, matchDayIndex - 1);
  const year = matchDate.getUTCFullYear();
  const month = matchDate.getUTCMonth();
  const day = matchDate.getUTCDate();

  return {
    scheduledFor: new Date(Date.UTC(year, month, day, 3, 0, 0)),
    submissionDeadline: new Date(Date.UTC(year, month, day, 17, 59, 0)),
    votingStart: new Date(Date.UTC(year, month, day, 18, 0, 0)),
    votingEnd: new Date(Date.UTC(year, month, day, 24, 59, 0)),
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
