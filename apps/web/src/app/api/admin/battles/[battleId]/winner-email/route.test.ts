import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const createBattleWinnerEmailDraft = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../../server/admin-battle-winner-email-service', () => ({
  createBattleWinnerEmailDraft,
}));

async function post(body: unknown, battleId = 'battle-1') {
  const { POST } = await import('./route');

  return POST(
    new Request(`http://localhost/api/admin/battles/${battleId}/winner-email`, {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
    { params: { battleId } },
  );
}

describe('POST /api/admin/battles/[battleId]/winner-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    createBattleWinnerEmailDraft.mockResolvedValue({
      winnerUserId: 'winner-1',
      email: 'winner@example.com',
      mailtoHref: 'mailto:winner@example.com',
    });
  });

  it('creates a winner email draft through the trusted admin route', async () => {
    const res = await post({ winnerUserId: 'winner-1' });

    await expect(res.json()).resolves.toEqual({
      winnerUserId: 'winner-1',
      email: 'winner@example.com',
      mailtoHref: 'mailto:winner@example.com',
    });
    expect(res.status).toBe(200);
    expect(createBattleWinnerEmailDraft).toHaveBeenCalledWith(
      { db: true },
      {
        adminUserId: 'admin-1',
        battleId: 'battle-1',
        body: { winnerUserId: 'winner-1' },
      },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
