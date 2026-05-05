import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const generateQualifierBracket = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../../server/qualifier-generation-service', () => ({
  generateQualifierBracket,
}));

async function post(body: unknown) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/admin/qualifiers/generate', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/admin/qualifiers/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    generateQualifierBracket.mockResolvedValue({
      participantCount: 100,
      matchCount: 36,
      byeCount: 28,
      dailyMatchLimit: 5,
      plannedMatchDays: 8,
      status: 'active',
    });
  });

  it('generates a qualifier bracket for valid admin input', async () => {
    const res = await post({ region: 'SP', category: 'freestyle' });

    await expect(res.json()).resolves.toMatchObject({
      participantCount: 100,
      matchCount: 36,
      byeCount: 28,
    });
    expect(res.status).toBe(200);
    expect(generateQualifierBracket).toHaveBeenCalledWith(
      { db: true },
      {
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
      },
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('rejects invalid state/category payloads before calling the service', async () => {
    const res = await post({ region: 'XX', category: 'invalid' });

    await expect(res.json()).resolves.toEqual({ error: 'Estado e obrigatorio' });
    expect(res.status).toBe(400);
    expect(generateQualifierBracket).not.toHaveBeenCalled();
  });
});
