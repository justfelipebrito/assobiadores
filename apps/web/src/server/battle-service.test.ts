import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCommunityBattle } from './battle-service';
import { ApiError } from './api-errors';
import { FREE_TIER_GROUP_CAP } from '@batalha/types';

function makeDates(offsetMinutes = 0) {
  const base = Date.now() + offsetMinutes * 60_000;
  const regEnd = new Date(base + 1 * 24 * 60 * 60_000).toISOString();
  const subDeadline = new Date(base + 2 * 24 * 60 * 60_000).toISOString();
  const voteStart = new Date(base + 3 * 24 * 60 * 60_000).toISOString();
  const voteEnd = new Date(base + 4 * 24 * 60 * 60_000).toISOString();
  return {
    registrationEnd: regEnd,
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
  rules: [],
  ...makeDates(),
};

function makeDb() {
  const ref = { id: 'battle-new', set: vi.fn() };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ref) })),
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
      }),
    );
  });

  it('creates a duel battle with maxParticipants forced to 2', async () => {
    const { db, ref } = makeDb();
    await createCommunityBattle(db as never, {
      userId: 'user-1',
      userPlan: 'free',
      body: validDuelBody,
    });

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'duel', maxParticipants: 2 }),
    );
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

  it('rejects registrationEnd in the past', async () => {
    const { db } = makeDb();
    const past = new Date(Date.now() - 1000).toISOString();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, registrationEnd: past },
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('futura') });
  });

  it('rejects submissionDeadline before registrationEnd', async () => {
    const { db } = makeDb();
    const dates = makeDates();
    await expect(
      createCommunityBattle(db as never, {
        userId: 'user-1',
        userPlan: 'free',
        body: { ...validGroupBody, ...dates, submissionDeadline: dates.registrationEnd },
      }),
    ).rejects.toMatchObject({ status: 400 });
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
