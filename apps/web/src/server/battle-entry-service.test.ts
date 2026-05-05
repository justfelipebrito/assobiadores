import { describe, expect, it, vi } from 'vitest';
import { createFreeBattleEntry } from './battle-entry-service';
import { ApiError } from './api-errors';

function createFirestoreMock({
  battle,
  battleExists = true,
  hasExistingEntry = false,
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  hasExistingEntry?: boolean;
}) {
  const battleRef = { id: 'battle-1' };
  const userRef = { id: 'user-1' };
  const entryRef = { id: 'entry-1' };
  const entryQuery = {
    where: vi.fn(() => entryQuery),
    limit: vi.fn(() => entryQuery),
  };

  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === battleRef) {
        return {
          exists: battleExists,
          data: () => battle,
        };
      }
      if (target === userRef) {
        return {
          exists: true,
          data: () => ({ displayName: 'User Local', username: 'userlocal' }),
        };
      }

      return {
        empty: !hasExistingEntry,
      };
    }),
    set: vi.fn(),
    update: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') {
        return {
          doc: vi.fn(() => battleRef),
        };
      }

      if (name === 'battleEntries') {
        return {
          doc: vi.fn(() => entryRef),
          where: entryQuery.where,
        };
      }

      if (name === 'users') {
        return {
          doc: vi.fn(() => userRef),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, battleRef, entryRef };
}

const openFreeBattle = {
  status: 'registration',
  entryFee: 0,
  maxParticipants: 10,
  currentParticipants: 2,
};

describe('createFreeBattleEntry', () => {
  it('creates a confirmed entry and increments participants inside a transaction', async () => {
    const { db, tx, battleRef, entryRef } = createFirestoreMock({ battle: openFreeBattle });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual({ entryId: 'entry-1' });

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(tx.set).toHaveBeenCalledWith(
      entryRef,
      expect.objectContaining({
        id: 'entry-1',
        battleId: 'battle-1',
        userId: 'user-1',
        userDisplayName: 'User Local',
        paymentId: null,
        status: 'confirmed',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      battleRef,
      expect.objectContaining({
        currentParticipants: expect.anything(),
        updatedAt: expect.anything(),
      }),
    );
  });

  it('rejects missing battle IDs before opening a transaction', async () => {
    const { db } = createFirestoreMock({ battle: openFreeBattle });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: '',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'battleId e obrigatorio' });

    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it('rejects missing battles', async () => {
    const { db } = createFirestoreMock({ battleExists: false });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects duplicate active entries', async () => {
    const { db, tx } = createFirestoreMock({
      battle: openFreeBattle,
      hasExistingEntry: true,
    });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Voce ja esta inscrito nesta batalha' });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects paid battles in the free entry path', async () => {
    const { db, tx } = createFirestoreMock({
      battle: {
        ...openFreeBattle,
        entryFee: 500,
      },
    });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Batalha paga, requer pagamento' });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects creators trying to participate in their own battle', async () => {
    const { db, tx } = createFirestoreMock({
      battle: {
        ...openFreeBattle,
        createdBy: 'user-1',
      },
    });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Criadores nao podem participar da propria batalha',
    });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects invite-only battles in the public free entry path', async () => {
    const { db, tx } = createFirestoreMock({
      battle: {
        ...openFreeBattle,
        visibility: 'invite_only',
      },
    });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Esta batalha aceita apenas participantes convidados',
    });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects full battles', async () => {
    const { db, tx } = createFirestoreMock({
      battle: {
        ...openFreeBattle,
        maxParticipants: 2,
        currentParticipants: 2,
      },
    });

    await expect(
      createFreeBattleEntry(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 409, message: 'Batalha lotada' });

    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
});
