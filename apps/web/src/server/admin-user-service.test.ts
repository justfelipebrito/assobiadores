import { describe, expect, it, vi } from 'vitest';
import { updateUserProfileAsAdmin } from './admin-user-service';

function createDb({
  adminRole = 'admin',
  targetExists = true,
  usernameTakenBy,
}: {
  adminRole?: string;
  targetExists?: boolean;
  usernameTakenBy?: string;
} = {}) {
  const refs = new Map<string, { path: string }>();
  const ref = (path: string) => {
    if (!refs.has(path)) refs.set(path, { path });
    return refs.get(path)!;
  };
  const adminRef = ref('users/admin-1');
  const targetRef = ref('users/user-1');
  const newUsernameRef = ref('usernames/newuser');
  const oldUsernameRef = ref('usernames/olduser');

  const tx = {
    get: vi.fn(async (target: { path: string }) => {
      if (target === adminRef) return { exists: true, data: () => ({ role: adminRole }) };
      if (target === targetRef) {
        return { exists: targetExists, data: () => ({ usernameLower: 'olduser' }) };
      }
      if (target === newUsernameRef) {
        return {
          exists: Boolean(usernameTakenBy),
          data: () => ({ userId: usernameTakenBy }),
        };
      }
      return { exists: false, data: () => ({}) };
    }),
    set: vi.fn(),
    delete: vi.fn(),
  };
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ref(`${name}/${id}`)),
    })),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, targetRef, newUsernameRef, oldUsernameRef };
}

describe('admin user service', () => {
  it('allows admins to correct public profile identity fields', async () => {
    const { db, tx, targetRef, newUsernameRef, oldUsernameRef } = createDb();

    await expect(
      updateUserProfileAsAdmin(db as never, {
        adminUserId: 'admin-1',
        targetUserId: 'user-1',
        body: {
          username: 'New User',
          firstName: 'Ana',
          surname: 'Silva',
          displayName: 'Ana Silva',
          bio: 'Corrigido',
        },
      }),
    ).resolves.toEqual({ ok: true, userId: 'user-1', username: 'newuser' });

    expect(tx.set).toHaveBeenCalledWith(
      newUsernameRef,
      expect.objectContaining({ userId: 'user-1', username: 'newuser' }),
    );
    expect(tx.delete).toHaveBeenCalledWith(oldUsernameRef);
    expect(tx.set).toHaveBeenCalledWith(
      targetRef,
      expect.objectContaining({
        username: 'newuser',
        firstName: 'Ana',
        surname: 'Silva',
        displayName: 'Ana Silva',
        bio: 'Corrigido',
        profileCorrectedBy: 'admin-1',
      }),
      { merge: true },
    );
  });

  it('blocks non-admin users', async () => {
    await expect(
      updateUserProfileAsAdmin(createDb({ adminRole: 'user' }).db as never, {
        adminUserId: 'user-2',
        targetUserId: 'user-1',
        body: { displayName: 'Ana Silva' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects usernames owned by another user', async () => {
    await expect(
      updateUserProfileAsAdmin(createDb({ usernameTakenBy: 'other-user' }).db as never, {
        adminUserId: 'admin-1',
        targetUserId: 'user-1',
        body: { username: 'New User' },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
