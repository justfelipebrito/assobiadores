import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminAuth: () => ({ verifyIdToken }),
}));

function requestWithAuthHeader(authorization?: string) {
  return new Request('http://localhost/api/protected', {
    headers: authorization ? { authorization } : {},
  }) as never;
}

describe('requireDecodedToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    verifyIdToken.mockResolvedValue({ uid: 'user-1' });
  });

  it('verifies bearer tokens through Firebase Admin Auth', async () => {
    const { requireDecodedToken } = await import('./auth');

    await expect(requireDecodedToken(requestWithAuthHeader('Bearer token-1'))).resolves.toEqual({
      uid: 'user-1',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('token-1');
  });

  it('rejects missing bearer tokens as unauthorized', async () => {
    const { requireDecodedToken } = await import('./auth');

    await expect(requireDecodedToken(requestWithAuthHeader())).rejects.toMatchObject({
      status: 401,
      message: 'Nao autorizado',
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('maps revoked or expired Firebase tokens to a controlled 401', async () => {
    const { requireDecodedToken } = await import('./auth');

    for (const code of ['auth/id-token-revoked', 'auth/id-token-expired', 'auth/invalid-id-token']) {
      verifyIdToken.mockRejectedValueOnce(Object.assign(new Error(code), { code }));

      await expect(requireDecodedToken(requestWithAuthHeader('Bearer stale-token'))).rejects.toMatchObject({
        status: 401,
        message: 'Sessao expirada. Entre novamente.',
      });
    }
  });

  it('preserves unexpected Firebase Admin errors for route-level logging', async () => {
    const { requireDecodedToken } = await import('./auth');
    const error = Object.assign(new Error('Firebase misconfigured'), { code: 'auth/invalid-credential' });
    verifyIdToken.mockRejectedValueOnce(error);

    await expect(requireDecodedToken(requestWithAuthHeader('Bearer token-1'))).rejects.toBe(error);
  });

  it('uses the Auth emulator host when emulator mode is enabled', async () => {
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    const { requireDecodedToken } = await import('./auth');

    await requireDecodedToken(requestWithAuthHeader('Bearer token-1'));

    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBe('127.0.0.1:9099');
  });
});
