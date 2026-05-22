import { describe, expect, it } from 'vitest';
import { getAdminBattleTieBreakOptions } from './admin-battle-tiebreak';

describe('getAdminBattleTieBreakOptions', () => {
  it('returns top tied confirmed submissions after voting ends', () => {
    const options = getAdminBattleTieBreakOptions({
      battle: {
        id: 'battle-1',
        status: 'voting',
        votingEnd: new Date('2026-05-01T12:00:00.000Z'),
      },
      entries: [
        { battleId: 'battle-1', userId: 'user-a', status: 'confirmed' },
        { battleId: 'battle-1', userId: 'user-b', status: 'confirmed' },
        { battleId: 'battle-1', userId: 'user-c', status: 'confirmed' },
      ],
      submissions: [
        { id: 'sub-a', battleId: 'battle-1', userId: 'user-a', status: 'approved', voteCount: 5 },
        { id: 'sub-b', battleId: 'battle-1', userId: 'user-b', status: 'approved', voteCount: 5 },
        { id: 'sub-c', battleId: 'battle-1', userId: 'user-c', status: 'approved', voteCount: 2 },
      ],
      votes: [],
      now: new Date('2026-05-01T12:01:00.000Z'),
    } as never);

    expect(options.map((option) => option.id)).toEqual(['sub-a', 'sub-b']);
  });

  it('returns no options before voting ends, without a top tie, or after tie-break exists', () => {
    const base = {
      battle: {
        id: 'battle-1',
        status: 'voting' as const,
        votingEnd: new Date('2026-05-01T12:00:00.000Z'),
      },
      entries: [
        { battleId: 'battle-1', userId: 'user-a', status: 'confirmed' as const },
        { battleId: 'battle-1', userId: 'user-b', status: 'confirmed' as const },
      ],
      submissions: [
        { id: 'sub-a', battleId: 'battle-1', userId: 'user-a', status: 'approved' as const, voteCount: 5 },
        { id: 'sub-b', battleId: 'battle-1', userId: 'user-b', status: 'approved' as const, voteCount: 5 },
      ],
    };

    expect(
      getAdminBattleTieBreakOptions({
        ...base,
        votes: [],
        now: new Date('2026-05-01T11:59:00.000Z'),
      }),
    ).toEqual([]);
    expect(
      getAdminBattleTieBreakOptions({
        ...base,
        submissions: [
          { id: 'sub-a', battleId: 'battle-1', userId: 'user-a', status: 'approved', voteCount: 6 },
          { id: 'sub-b', battleId: 'battle-1', userId: 'user-b', status: 'approved', voteCount: 5 },
        ],
        votes: [],
        now: new Date('2026-05-01T12:01:00.000Z'),
      }),
    ).toEqual([]);
    expect(
      getAdminBattleTieBreakOptions({
        ...base,
        votes: [{ battleId: 'battle-1', voterType: 'judge' }],
        now: new Date('2026-05-01T12:01:00.000Z'),
      }),
    ).toEqual([]);
  });
});
