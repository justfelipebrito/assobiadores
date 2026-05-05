import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const finalizeBattle = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/battle-finalization-service', () => ({ finalizeBattle }));

async function post(body: unknown) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/admin/battles/finalize', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/admin/battles/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    finalizeBattle.mockResolvedValue({
      success: true,
      winners: [{ userId: 'user-a', place: 1 }],
    });
  });

  it('finalizes a battle through the trusted web route', async () => {
    const res = await post({ battleId: 'battle-1' });

    await expect(res.json()).resolves.toMatchObject({
      success: true,
      winners: [{ userId: 'user-a', place: 1 }],
    });
    expect(res.status).toBe(200);
    expect(finalizeBattle).toHaveBeenCalledWith(
      { db: true },
      { actorUserId: 'admin-1', battleId: 'battle-1' },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
