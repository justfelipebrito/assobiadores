import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BATTLE_CREATE_FUTURE_BUFFER_MS, createCommunityBattle } from './battle-service';
import { ApiError } from './api-errors';
import { FREE_TIER_GROUP_CAP } from '@batalha/types';

function makeDates(offsetMinutes = 0) {
  const base = Date.now() + offsetMinutes * 60_000;
  const subDeadline = new Date(base + 2 * 24 * 60 * 60_000).toISOString();
  const voteStart = new Date(base + 3 * 24 * 60 * 60_000).toISOString();
  const voteEnd = new Date(base + 4 * 24 * 60 * 60_000).toISOString();
  return {
    submissionDeadline: subDeadline,
    votingStart: voteStart,
    votingEnd: voteEnd,
  };
}

const validGroupBody = {
  title: 'Batalha Teste',
  description: 'Descricao',
  format: 'group',
  category: 'freestyle',
  maxParticipants: 10,
  votingType: 'public',
  visibility: 'public',
  rules: [],
  ...makeDates(),
};

const validDuelBody = {
  title: 'Duelo Teste',
  description: '',
  format: 'duel',
  category: 'passaros',
  maxParticipants: 2,
  votingType: 'public',
  visibility: 'invite_only',
  rules: [],
  ...makeDates(),
};

function makeDb() {
  const ref = { id: 'battle-new', set: vi.fn() };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') return { doc: vi.fn(() => ref) };
      throw new Error(`Unexpected collection ${name}`);
    }),
  };
  return { db, ref };
}

describe('createCommunityBattle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a community group battle and returns battleId', async () => {
    const { db, ref } = makeDb();
    const result = await createCommunityBattle(db as never, {
      userId: 'user-1',
      userPlan: 'free',
      body: validGroupBody,
    });

    expect(result).toEqual({ battleId: 'battle-new' });
    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'community',
        format: 'group',
        status: 'registration',
        createdBy: 'user-1',
        entryFee: 0,
        votingType: 'public',
        visibility: 'public',
        judges: ['user-1'],
        registrationEnd: expect.anything(),
        submissionDeadline: expect.anything(),
      }),
    );
  });

  it('accepts create requests without registrationEnd and derives it from submissionDeadline', async () => {
    const { db, ref } = makeDb();

    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: validGroupBody,
      }),
    ).resolves.toEqual({ battleId: 'battle-new' });

    const stored = vi.mocked(ref.set).mock.calls[0]?.[0] as {
      registrationEnd?: { toDate?: () => Date };
      submissionDeadline?: { toDate?: () => Date };
    };
    expect(stored.registrationEnd?.toDate?.()?.toISOString()).toBe(
      stored.submissionDeadline?.toDate?.()?.toISOString(),
    );
  });

  it('creates a duel battle with maxParticipants and public voting forced', async () => {
    const { db, ref } = makeDb();
    await createCommunityBattle(db as never, {
      userId: 'user-1',
      userPlan: 'free',
      body: validDuelBody,
    });

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'duel',
        maxParticipants: 2,
        votingType: 'public',
        visibility: 'invite_only',
        judges: ['user-1'],
      }),
    );
  });

  it('rejects group battles below the scoring minimum', async () => {
    const { db } = makeDb();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, maxParticipants: 2 },
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('pelo menos 5') });
  });

  it('blocks free-tier users from exceeding the group cap', async () => {
    const { db } = makeDb();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, maxParticipants: FREE_TIER_GROUP_CAP + 1 },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows pro users to exceed the free-tier cap', async () => {
    const { db, ref } = makeDb();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'pro',
        body: { ...validGroupBody, maxParticipants: FREE_TIER_GROUP_CAP },
      }),
    ).resolves.toEqual({ battleId: 'battle-new' });
    expect(ref.set).toHaveBeenCalled();
  });

  it('rejects missing title', async () => {
    const { db } = makeDb();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, title: '' },
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects unknown category', async () => {
    const { db } = makeDb();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, category: 'rap' },
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects submissionDeadline in the past', async () => {
    const { db } = makeDb();
    const past = new Date(Date.now() - BATTLE_CREATE_FUTURE_BUFFER_MS - 1000).toISOString();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, submissionDeadline: past },
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('futuro') });
  });

  it('allows near-future submission deadlines within the clock-drift buffer', async () => {
    const { db, ref } = makeDb();
    const nearFuture = new Date(Date.now() + Math.floor(BATTLE_CREATE_FUTURE_BUFFER_MS / 2)).toISOString();
    const votingStart = new Date(Date.now() + 2 * 60_000).toISOString();
    const votingEnd = new Date(Date.now() + 4 * 60_000).toISOString();

    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: {
          ...validGroupBody,
          submissionDeadline: nearFuture,
          votingStart,
          votingEnd,
        },
      }),
    ).resolves.toEqual({ battleId: 'battle-new' });
    expect(ref.set).toHaveBeenCalled();
  });

  it('rejects votingStart before submissionDeadline', async () => {
    const { db } = makeDb();
    const dates = makeDates();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, ...dates, votingStart: dates.submissionDeadline },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects votingEnd before votingStart', async () => {
    const { db } = makeDb();
    const dates = makeDates();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, ...dates, votingEnd: dates.votingStart },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
