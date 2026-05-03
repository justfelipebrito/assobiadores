import { describe, expect, it, vi } from 'vitest';
import {
  checkUsernameAvailability,
  isValidCpf,
  normalizeUsername,
  updateUserProfile,
} from './profile-service';

function createQuery(empty: boolean, id = 'other-user') {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => ({ empty, docs: empty ? [] : [{ id }] })),
  };
  return query;
}

function createDb({
  usernameReservation,
  existingUserEmpty = true,
  currentUsername = 'olduser',
  userData = {},
  privateData = {},
}: {
  usernameReservation?: { userId: string };
  existingUserEmpty?: boolean;
  currentUsername?: string;
  userData?: Record<string, unknown>;
  privateData?: Record<string, unknown>;
} = {}) {
  const userRef = { id: 'user-1' };
  const privateRef = { id: 'user-1-private' };
  const newUsernameRef = { id: 'newuser' };
  const oldUsernameRef = { id: 'olduser' };
  const userQuery = createQuery(existingUserEmpty);

  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === userRef) {
        return { exists: true, data: () => ({ usernameLower: currentUsername, ...userData }) };
      }
      if (target === privateRef) {
        return { exists: true, data: () => privateData };
      }
      return { exists: false };
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return { doc: vi.fn(() => userRef), where: userQuery.where };
      }
      if (name === 'userPrivate') return { doc: vi.fn(() => privateRef) };
      if (name === 'usernames') {
        return {
          doc: vi.fn((id: string) => ({
            ...(id === 'olduser' ? oldUsernameRef : newUsernameRef),
            get: vi.fn(async () => ({
              exists: Boolean(usernameReservation),
              data: () => usernameReservation,
            })),
          })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, userRef, privateRef };
}

describe('profile service', () => {
  it('normalizes usernames and validates CPF', () => {
    expect(normalizeUsername(' João_Silva! ')).toBe('joao_silva');
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('checks username availability using reservations', async () => {
    await expect(
      checkUsernameAvailability(
        createDb({ usernameReservation: { userId: 'other-user' } }).db as never,
        'newuser',
        'user-1',
      ),
    ).resolves.toEqual({ username: 'newuser', available: false });

    await expect(
      checkUsernameAvailability(
        createDb({ usernameReservation: { userId: 'user-1' } }).db as never,
        'newuser',
        'user-1',
      ),
    ).resolves.toEqual({ username: 'newuser', available: true });
  });

  it('keeps the current username available for the current user', async () => {
    await expect(
      checkUsernameAvailability(
        createDb({ usernameReservation: { userId: 'user-1' } }).db as never,
        'User Local',
        'user-1',
      ),
    ).resolves.toEqual({ username: 'userlocal', available: true });
  });

  it('updates public and private profile fields transactionally', async () => {
    const { db, tx } = createDb();

    await expect(
      updateUserProfile(db as never, 'user-1', {
        username: 'New User',
        firstName: 'Ana',
        surname: 'Silva',
        displayName: 'Ana Silva',
        birthState: 'SP',
        cpf: '529.982.247-25',
        phone: '(11) 99999-9999',
        address: { city: 'Sao Paulo', state: 'SP' },
      }),
    ).resolves.toEqual({ ok: true, username: 'newuser' });

    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'newuser' }),
      expect.objectContaining({ userId: 'user-1', username: 'newuser' }),
    );
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        username: 'newuser',
        firstName: 'Ana',
        surname: 'Silva',
        birthState: 'SP',
      }),
      { merge: true },
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1-private' }),
      expect.objectContaining({
        cpf: '52998224725',
        phone: '11999999999',
        'address.city': 'Sao Paulo',
      }),
    );
  });

  it('rejects invalid CPF', async () => {
    await expect(
      updateUserProfile(createDb().db as never, 'user-1', { cpf: '11111111111' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects invalid Brazilian phone and CEP values', async () => {
    await expect(
      updateUserProfile(createDb().db as never, 'user-1', { phone: '12345' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Use DDD + telefone, somente numeros.',
    });

    await expect(
      updateUserProfile(createDb().db as never, 'user-1', {
        address: { postalCode: '123' },
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Use um CEP valido com 8 digitos.' });
  });

  it('blocks CPF and birth state changes after they are set', async () => {
    await expect(
      updateUserProfile(createDb({ privateData: { cpf: '52998224725' } }).db as never, 'user-1', {
        cpf: '390.533.447-05',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'CPF nao pode ser alterado depois de definido',
    });

    await expect(
      updateUserProfile(createDb({ userData: { birthState: 'SP' } }).db as never, 'user-1', {
        birthState: 'RJ',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Naturalidade nao pode ser alterada depois de definida',
    });
  });

  it('blocks username and address changes while the 14 day cooldown is active', async () => {
    const future = { toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000) };

    await expect(
      updateUserProfile(
        createDb({ userData: { usernameChangeAvailableAt: future } }).db as never,
        'user-1',
        { username: 'newuser' },
      ),
    ).rejects.toMatchObject({
      status: 429,
      message: 'Username so pode ser alterado novamente em 14 dias',
    });

    await expect(
      updateUserProfile(
        createDb({
          userData: { addressChangeAvailableAt: future },
          privateData: {
            address: { city: 'Sao Paulo', postalCode: '01310100', street: 'Rua A', number: '1' },
          },
        }).db as never,
        'user-1',
        { address: { city: 'Sao Paulo', postalCode: '01310100', street: 'Rua B', number: '1' } },
      ),
    ).rejects.toMatchObject({
      status: 429,
      message: 'Endereco so pode ser alterado novamente em 14 dias',
    });
  });
});
