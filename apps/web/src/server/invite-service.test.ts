import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendBattleInvite, respondToInvite } from './invite-service';
import { ApiError } from './api-errors';

function makeDb({
  battleData = { createdBy: 'owner-1', status: 'registration', title: 'Test Battle' } as Record<string, unknown> | null,
  battleExists = true,
  fromUser = { displayName: 'Owner User' } as Record<string, unknown>,
  targetUser = { id: 'user-2', data: () => ({ username: 'target', displayName: 'Target User' }) } as { id: string; data: () => Record<string, unknown> } | null,
  hasPendingInvite = false,
  inviteData = null as Record<string, unknown> | null,
} = {}) {
  const inviteRef = { id: 'invite-1', set: vi.fn(), update: vi.fn() };
  const usernameQuery = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(async () => ({
      empty: !targetUser,
      docs: targetUser ? [targetUser] : [],
    })),
  };
  const pendingInviteQuery = {
    where: vi.fn(),
    limit: vi.fn(),
    get: vi.fn(async () => ({ empty: !hasPendingInvite })),
  };
  pendingInviteQuery.where.mockReturnValue(pendingInviteQuery);
  pendingInviteQuery.limit.mockReturnValue(pendingInviteQuery);

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: battleExists, data: () => battleData })),
          })),
        };
      }
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: true, data: () => fromUser })),
          })),
          ...usernameQuery,
        };
      }
      if (name === 'battleInvites') {
        return {
          doc: vi.fn((id?: string) => {
            if (!id) return inviteRef;
            return {
              get: vi.fn(async () => ({
                exists: !!inviteData,
                data: () => inviteData,
                ref: inviteRef,
              })),
            };
          }),
          where: pendingInviteQuery.where,
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, inviteRef };
}

describe('sendBattleInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a pending invite and returns recipient info', async () => {
    const { db, inviteRef } = makeDb();
    const result = await sendBattleInvite(db as never, {
      battleId: 'battle-1',
      fromUserId: 'owner-1',
      toUsername: 'target',
    });

    expect(result.inviteId).toBe('invite-1');
    expect(result.toUserId).toBe('user-2');
    expect(inviteRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        battleId: 'battle-1',
        battleTitle: 'Test Battle',
        fromUserId: 'owner-1',
        fromDisplayName: 'Owner User',
        toUserId: 'user-2',
        status: 'pending',
      }),
    );
  });

  it('rejects if battle does not exist', async () => {
    const { db } = makeDb({ battleExists: false });
    await expect(
      sendBattleInvite(db as never, { battleId: 'x', fromUserId: 'owner-1', toUsername: 'target' }),
    ).rejects.toMatchObject({ status: 404, message: 'Batalha nao encontrada' });
  });

  it('rejects if sender is not the battle creator', async () => {
    const { db } = makeDb();
    await expect(
      sendBattleInvite(db as never, { battleId: 'battle-1', fromUserId: 'other-user', toUsername: 'target' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects if battle is not in registration phase', async () => {
    const { db } = makeDb({ battleData: { createdBy: 'owner-1', status: 'active' } });
    await expect(
      sendBattleInvite(db as never, { battleId: 'battle-1', fromUserId: 'owner-1', toUsername: 'target' }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('inscricoes') });
  });

  it('rejects if username not found', async () => {
    const { db } = makeDb({ targetUser: null });
    await expect(
      sendBattleInvite(db as never, { battleId: 'battle-1', fromUserId: 'owner-1', toUsername: 'ghost' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects self-invite', async () => {
    const { db } = makeDb({ targetUser: { id: 'owner-1', data: () => ({ username: 'owner', displayName: 'Owner' }) } });
    await expect(
      sendBattleInvite(db as never, { battleId: 'battle-1', fromUserId: 'owner-1', toUsername: 'owner' }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('si mesmo') });
  });

  it('rejects duplicate pending invite', async () => {
    const { db } = makeDb({ hasPendingInvite: true });
    await expect(
      sendBattleInvite(db as never, { battleId: 'battle-1', fromUserId: 'owner-1', toUsername: 'target' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('respondToInvite', () => {
  it('accepts an invite', async () => {
    const { db, inviteRef } = makeDb({
      inviteData: { toUserId: 'user-2', status: 'pending' },
    });
    const result = await respondToInvite(db as never, { inviteId: 'invite-1', userId: 'user-2', accept: true });
    expect(result.status).toBe('accepted');
    expect(inviteRef.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });

  it('declines an invite', async () => {
    const { db } = makeDb({ inviteData: { toUserId: 'user-2', status: 'pending' } });
    const result = await respondToInvite(db as never, { inviteId: 'invite-1', userId: 'user-2', accept: false });
    expect(result.status).toBe('declined');
  });

  it('rejects if invite not found', async () => {
    const { db } = makeDb({ inviteData: null });
    await expect(
      respondToInvite(db as never, { inviteId: 'invite-1', userId: 'user-2', accept: true }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects if user is not the invitee', async () => {
    const { db } = makeDb({ inviteData: { toUserId: 'user-2', status: 'pending' } });
    await expect(
      respondToInvite(db as never, { inviteId: 'invite-1', userId: 'wrong-user', accept: true }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects responding to an already-answered invite', async () => {
    const { db } = makeDb({ inviteData: { toUserId: 'user-2', status: 'accepted' } });
    await expect(
      respondToInvite(db as never, { inviteId: 'invite-1', userId: 'user-2', accept: true }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
