import { describe, expect, it, vi } from 'vitest';
import { bootstrapUserProfile, normalizeBootstrapUsername } from './user-bootstrap-service';

function createDb({
  userExists = false,
  privateExists = false,
  reservedUsernames = {},
}: {
  userExists?: boolean;
  privateExists?: boolean;
  reservedUsernames?: Record<string, string>;
} = {}) {
  const refs = new Map<string, { id: string; path: string }>();
  const refFor = (collection: string, id: string) => {
    const path = `${collection}/${id}`;
    if (!refs.has(path)) refs.set(path, { id, path });
    return refs.get(path);
  };

  const tx = {
    get: vi.fn(async (ref: { path: string }) => {
      if (ref.path.startsWith('users/')) {
        return {
          exists: userExists,
          data: () => ({ usernameLower: 'existing_user' }),
        };
      }
      if (ref.path.startsWith('userPrivate/')) {
        return { exists: privateExists, data: () => ({}) };
      }
      if (ref.path.startsWith('usernames/')) {
        const username = ref.path.split('/')[1] ?? '';
        const userId = reservedUsernames[username];
        return {
          exists: Boolean(userId),
          data: () => ({ userId, username }),
        };
      }
      return { exists: false, data: () => ({}) };
    }),
    set: vi.fn(),
  };

  const db = {
    collection: vi.fn((collection: string) => ({
      doc: vi.fn((id: string) => refFor(collection, id)),
    })),
    doc: vi.fn((path: string) => {
      if (!refs.has(path)) refs.set(path, { id: path.split('/').at(-1) ?? path, path });
      return refs.get(path);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx };
}

describe('user bootstrap service', () => {
  it('normalizes initial usernames', () => {
    expect(normalizeBootstrapUsername(' João Silva!! ')).toBe('joaosilva');
  });

  it('creates public, private, and username reservation docs', async () => {
    const { db, tx } = createDb();

    await expect(
      bootstrapUserProfile(db as never, {
        uid: 'user-abc12345',
        email: 'ana@example.com',
        displayName: 'Ana Silva',
        photoURL: 'https://example.com/avatar.jpg',
      }),
    ).resolves.toEqual({ created: true, username: 'anasilva' });

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'usernames/anasilva' }),
      expect.objectContaining({ userId: 'user-abc12345', username: 'anasilva' }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-abc12345' }),
      expect.objectContaining({
        id: 'user-abc12345',
        username: 'anasilva',
        usernameLower: 'anasilva',
        displayName: 'Ana Silva',
        accountType: 'free',
        seasonCategoryPoints: {},
      }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'userPrivate/user-abc12345' }),
      expect.objectContaining({ id: 'user-abc12345', cpf: '', pixKey: '' }),
      { merge: true },
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'seasonRankings/2026/users/user-abc12345' }),
      expect.objectContaining({
        id: 'user-abc12345',
        userId: 'user-abc12345',
        totalPoints: 0,
        byCategory: {},
      }),
      { merge: true },
    );
  });

  it('does not overwrite an existing public user and backfills private data only when missing', async () => {
    const { db, tx } = createDb({ userExists: true, privateExists: false });

    await expect(
      bootstrapUserProfile(db as never, {
        uid: 'user-existing',
        email: 'user@example.com',
      }),
    ).resolves.toEqual({ created: false, username: 'existing_user' });

    expect(tx.set).toHaveBeenCalledTimes(2);
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'userPrivate/user-existing' }),
      expect.objectContaining({ id: 'user-existing' }),
      { merge: true },
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'seasonRankings/2026/users/user-existing' }),
      expect.objectContaining({ id: 'user-existing', userId: 'user-existing' }),
      { merge: true },
    );
  });

  it('falls back to a uid-suffixed username when the default is reserved', async () => {
    const { db } = createDb({ reservedUsernames: { anasilva: 'other-user' } });

    await expect(
      bootstrapUserProfile(db as never, {
        uid: 'ABC123456789',
        email: 'ana@example.com',
        displayName: 'Ana Silva',
      }),
    ).resolves.toEqual({ created: true, username: 'anasilva_abc123' });
  });
});
