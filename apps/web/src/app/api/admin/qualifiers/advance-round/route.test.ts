import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const advanceQualifierRound = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/qualifier-advancement-service', () => ({
  advanceQualifierRound,
}));

async function post(body: unknown) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/admin/qualifiers/advance-round', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/admin/qualifiers/advance-round', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    advanceQualifierRound.mockResolvedValue({
      status: 'active',
      roundNumber: 2,
      matchCount: 128,
      byeCount: 0,
    });
  });

  it('advances a qualifier round through the trusted service', async () => {
    const res = await post({ region: 'SP', category: 'freestyle', roundNumber: 1 });

    await expect(res.json()).resolves.toMatchObject({
      status: 'active',
      roundNumber: 2,
      matchCount: 128,
    });
    expect(res.status).toBe(200);
    expect(advanceQualifierRound).toHaveBeenCalledWith(
      { db: true },
      {
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
        eventId: undefined,
        roundNumber: 1,
      },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('advances a mini qualifier round by event id without requiring a state', async () => {
    const res = await post({ category: 'freestyle', eventId: 'mini-qualifier-2026-freestyle' });

    expect(res.status).toBe(200);
    expect(advanceQualifierRound).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({
        adminUserId: 'admin-1',
        category: 'freestyle',
        eventId: 'mini-qualifier-2026-freestyle',
      }),
    );
  });

  it('rejects invalid payloads before calling the service', async () => {
    const res = await post({ region: 'XX', category: 'freestyle' });

    await expect(res.json()).resolves.toEqual({ error: 'Estado e obrigatorio' });
    expect(res.status).toBe(400);
    expect(advanceQualifierRound).not.toHaveBeenCalled();
  });
});
