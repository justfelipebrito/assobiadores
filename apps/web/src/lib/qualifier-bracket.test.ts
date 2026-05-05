import { describe, expect, it } from 'vitest';
import {
  buildInitialQualifierMatchPlans,
  buildQualifierBracketPlan,
  buildQualifierRoundMatchPlans,
  getQualifierDailyMatchLimit,
} from './qualifier-bracket';

function entrants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    userId: `user-${index + 1}`,
    registrationId: `registration-${index + 1}`,
  }));
}

describe('qualifier bracket planning', () => {
  it.each([
    [50, 5, 0, 0, []],
    [100, 5, 36, 8, [36]],
    [500, 12, 436, 38, [244, 128, 64]],
    [1000, 24, 936, 41, [488, 256, 128, 64]],
  ])(
    'plans a capped daily schedule for %i participants',
    (participantCount, dailyLimit, totalMatches, totalDays, roundMatches) => {
      const plan = buildQualifierBracketPlan({ participantCount });

      expect(plan.dailyMatchLimit).toBe(dailyLimit);
      expect(plan.totalMatchCount).toBe(totalMatches);
      expect(plan.totalMatchDays).toBe(totalDays);
      expect(plan.rounds.map((round) => round.matchCount)).toEqual(roundMatches);
    },
  );

  it('uses the configured match limit tiers', () => {
    expect(getQualifierDailyMatchLimit(50)).toBe(5);
    expect(getQualifierDailyMatchLimit(100)).toBe(5);
    expect(getQualifierDailyMatchLimit(101)).toBe(12);
    expect(getQualifierDailyMatchLimit(500)).toBe(12);
    expect(getQualifierDailyMatchLimit(501)).toBe(24);
  });

  it('creates only the initial round pairings and byes', () => {
    const result = buildInitialQualifierMatchPlans({
      entrants: entrants(100),
      seasonId: 'season-2026',
      category: 'freestyle',
      region: 'SP',
      startsAt: new Date('2026-06-01T03:00:00.000Z'),
      rng: () => 0,
    });

    expect(result.matchPlans).toHaveLength(36);
    expect(result.byeEntrants).toHaveLength(28);
    expect(result.matchPlans[0]).toEqual(
      expect.objectContaining({
        roundNumber: 1,
        roundLabel: 'Rodada 1',
        matchDayIndex: 1,
        sequenceInDay: 1,
      }),
    );
    expect(result.matchPlans[35]).toEqual(
      expect.objectContaining({
        matchDayIndex: 8,
        sequenceInDay: 1,
      }),
    );
  });

  it('uses BRT submission and voting windows for each scheduled match day', () => {
    const result = buildInitialQualifierMatchPlans({
      entrants: entrants(66),
      seasonId: 'season-2026',
      category: 'melodia',
      region: 'RJ',
      startsAt: new Date('2026-06-01T03:00:00.000Z'),
      rng: () => 0,
    });

    expect(result.matchPlans).toHaveLength(2);
    expect(result.matchPlans[0]?.scheduledFor.toISOString()).toBe('2026-06-01T03:00:00.000Z');
    expect(result.matchPlans[0]?.submissionDeadline.toISOString()).toBe('2026-06-01T17:59:00.000Z');
    expect(result.matchPlans[0]?.votingStart.toISOString()).toBe('2026-06-01T18:00:00.000Z');
    expect(result.matchPlans[0]?.votingEnd.toISOString()).toBe('2026-06-02T00:59:00.000Z');
  });

  it('creates later round pairings from waiting entrants using the original match day index', () => {
    const result = buildQualifierRoundMatchPlans({
      entrants: entrants(256),
      roundNumber: 2,
      dailyMatchLimit: 12,
      startsOnDayIndex: 22,
      startsAt: new Date('2026-06-01T03:00:00.000Z'),
      seasonId: 'season-2026',
      category: 'freestyle',
      region: 'SP',
      rng: () => 0,
    });

    expect(result.matchPlans).toHaveLength(128);
    expect(result.byeEntrants).toHaveLength(0);
    expect(result.matchPlans[0]).toEqual(
      expect.objectContaining({
        roundNumber: 2,
        roundLabel: 'Rodada 2',
        matchDayIndex: 22,
        sequenceInDay: 1,
      }),
    );
    expect(result.matchPlans[12]).toEqual(
      expect.objectContaining({
        matchDayIndex: 23,
        sequenceInDay: 1,
      }),
    );
  });
});
