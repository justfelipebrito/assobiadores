import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const migrateQualifierEntriesToMiniKnockout = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/qualifier-mini-migration-service', () => ({
  migrateQualifierEntriesToMiniKnockout,
}));

async function post(body: unknown) {
  const { POST } = await import('./route');
  return POST(
    new Request('http://localhost/api/admin/qualifiers/mini-migrate', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/admin/qualifiers/mini-migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    getAdminFirestore.mockReturnValue({ id: 'db' });
    migrateQualifierEntriesToMiniKnockout.mockResolvedValue({
      eventId: 'mini-qualifier-2026-freestyle',
      participantCount: 10,
      matchCount: 2,
      prizePoolCents: 3200,
    });
  });

  it('migrates paid qualifier entries through a trusted admin route', async () => {
    const res = await post({ category: 'freestyle' });

    await expect(res.json()).resolves.toMatchObject({
      eventId: 'mini-qualifier-2026-freestyle',
      participantCount: 10,
      matchCount: 2,
    });
    expect(res.status).toBe(200);
    expect(migrateQualifierEntriesToMiniKnockout).toHaveBeenCalledWith(
      { id: 'db' },
      expect.objectContaining({
        adminUserId: 'admin-1',
        category: 'freestyle',
      }),
    );
  });

  it('rejects invalid categories before touching the service', async () => {
    const res = await post({ category: 'beatbox' });

    await expect(res.json()).resolves.toEqual({ error: 'Categoria e obrigatoria' });
    expect(res.status).toBe(400);
    expect(migrateQualifierEntriesToMiniKnockout).not.toHaveBeenCalled();
  });

  it('rejects non-freestyle mini categories before touching the service', async () => {
    const res = await post({ category: 'melodia' });

    await expect(res.json()).resolves.toEqual({
      error: 'Mini Classificatoria esta disponivel apenas para Freestyle.',
    });
    expect(res.status).toBe(400);
    expect(migrateQualifierEntriesToMiniKnockout).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));

    const res = await post({ category: 'freestyle' });

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
    expect(migrateQualifierEntriesToMiniKnockout).not.toHaveBeenCalled();
  });
});
