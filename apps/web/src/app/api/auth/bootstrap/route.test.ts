import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const bootstrapUserProfile = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/user-bootstrap-service', () => ({
  bootstrapUserProfile,
}));

async function post(
  body: unknown = { displayName: 'Ana Silva', photoURL: 'https://avatar.test/a.jpg' },
) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/auth/bootstrap', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/auth/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({
      uid: 'user-1',
      email: 'ana@example.com',
      name: 'Token Name',
      picture: 'https://avatar.test/token.jpg',
    });
    bootstrapUserProfile.mockResolvedValue({ created: true, username: 'anasilva' });
  });

  it('bootstraps profile documents for the authenticated user', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({ created: true, username: 'anasilva' });
    expect(res.status).toBe(200);
    expect(bootstrapUserProfile).toHaveBeenCalledWith('db', {
      uid: 'user-1',
      email: 'ana@example.com',
      displayName: 'Ana Silva',
      photoURL: 'https://avatar.test/a.jpg',
    });
  });

  it('falls back to token profile fields when body fields are absent', async () => {
    const res = await post({});

    expect(res.status).toBe(200);
    expect(bootstrapUserProfile).toHaveBeenCalledWith('db', {
      uid: 'user-1',
      email: 'ana@example.com',
      displayName: 'Token Name',
      photoURL: 'https://avatar.test/token.jpg',
    });
  });

  it('returns auth and service errors without bootstrapping', async () => {
    requireDecodedToken.mockRejectedValueOnce(new ApiError(401, 'Nao autorizado'));

    const unauthorized = await post();

    await expect(unauthorized.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(unauthorized.status).toBe(401);
    expect(bootstrapUserProfile).not.toHaveBeenCalled();

    requireDecodedToken.mockResolvedValueOnce({ uid: 'user-1', email: 'ana@example.com' });
    bootstrapUserProfile.mockRejectedValueOnce(new ApiError(409, 'Username indisponivel'));

    const conflict = await post();

    await expect(conflict.json()).resolves.toEqual({ error: 'Username indisponivel' });
    expect(conflict.status).toBe(409);
  });
});
