import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const finalizeQualifierMatch = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/qualifier-finalization-service', () => ({
  finalizeQualifierMatch,
}));

async function post(body: unknown) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/admin/qualifiers/finalize-match', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/admin/qualifiers/finalize-match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    finalizeQualifierMatch.mockResolvedValue({
      matchId: 'match-1',
      status: 'finished',
      winnerId: 'user-a',
    });
  });

  it('finalizes a qualifier match through the trusted service', async () => {
    const res = await post({ matchId: 'match-1' });

    await expect(res.json()).resolves.toMatchObject({
      matchId: 'match-1',
      status: 'finished',
      winnerId: 'user-a',
    });
    expect(res.status).toBe(200);
    expect(finalizeQualifierMatch).toHaveBeenCalledWith(
      { db: true },
      { adminUserId: 'admin-1', matchId: 'match-1' },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
