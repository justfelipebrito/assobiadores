import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const finalizeBattle = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/battle-finalization-service', () => ({ finalizeBattle }));

describe('POST /api/battles/[battleId]/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'creator-1' });
    finalizeBattle.mockResolvedValue({ success: true, winners: [] });
  });

  it('finalizes a battle as the authenticated creator through the trusted route', async () => {
    const { POST } = await import('./route');

    const res = await POST(new Request('http://localhost/api/battles/battle-1/finalize') as never, {
      params: { battleId: 'battle-1' },
    });

    await expect(res.json()).resolves.toEqual({ success: true, winners: [] });
    expect(finalizeBattle).toHaveBeenCalledWith('db', {
      actorUserId: 'creator-1',
      battleId: 'battle-1',
    });
  });
});
