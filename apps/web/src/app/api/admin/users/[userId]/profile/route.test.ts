import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const updateUserProfileAsAdmin = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../../server/admin-user-service', () => ({ updateUserProfileAsAdmin }));

async function post(body: unknown, userId = 'user-1') {
  const { POST } = await import('./route');

  return POST(
    new Request(`http://localhost/api/admin/users/${userId}/profile`, {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
    { params: { userId } },
  );
}

describe('POST /api/admin/users/[userId]/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    updateUserProfileAsAdmin.mockResolvedValue({ ok: true, userId: 'user-1' });
  });

  it('updates a user through the trusted admin route', async () => {
    const res = await post({ displayName: 'Ana Silva' });

    await expect(res.json()).resolves.toEqual({ ok: true, userId: 'user-1' });
    expect(res.status).toBe(200);
    expect(updateUserProfileAsAdmin).toHaveBeenCalledWith(
      { db: true },
      {
        adminUserId: 'admin-1',
        targetUserId: 'user-1',
        body: { displayName: 'Ana Silva' },
      },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
