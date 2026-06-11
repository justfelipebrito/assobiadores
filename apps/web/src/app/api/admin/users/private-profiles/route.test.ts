import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const listAdminUserPrivateSummaries = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/admin-user-private-service', () => ({
  listAdminUserPrivateSummaries,
}));

async function get() {
  const { GET } = await import('./route');

  return GET(
    new Request('http://localhost/api/admin/users/private-profiles', {
      method: 'GET',
      headers: { authorization: 'Bearer token' },
    }) as never,
  );
}

describe('GET /api/admin/users/private-profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    listAdminUserPrivateSummaries.mockResolvedValue({
      profiles: [{ userId: 'user-1', pixKey: 'pix@example.com', hasCpf: true, hasPhone: false }],
    });
  });

  it('returns private profile summaries through the trusted admin route', async () => {
    const res = await get();

    await expect(res.json()).resolves.toEqual({
      profiles: [{ userId: 'user-1', pixKey: 'pix@example.com', hasCpf: true, hasPhone: false }],
    });
    expect(res.status).toBe(200);
    expect(listAdminUserPrivateSummaries).toHaveBeenCalledWith(
      { db: true },
      { adminUserId: 'admin-1' },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
