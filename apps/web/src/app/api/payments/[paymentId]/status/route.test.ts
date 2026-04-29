import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

function createDb(paymentDoc: unknown) {
  const get = vi.fn(async () => paymentDoc);
  const doc = vi.fn(() => ({ get }));
  const collection = vi.fn(() => ({ doc }));

  return { collection, doc, get };
}

async function getStatus(paymentId = 'payment-1') {
  const { GET } = await import('./route');

  return GET(new Request(`http://localhost/api/payments/${paymentId}/status`) as never, {
    params: { paymentId },
  });
}

describe('GET /api/payments/[paymentId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
  });

  it('returns payment status for the owner', async () => {
    const db = createDb({
      exists: true,
      data: () => ({
        userId: 'user-1',
        status: 'approved',
        entryId: 'entry-1',
        expiresAt: { toDate: () => new Date('2026-04-29T00:00:00.000Z') },
      }),
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({
      status: 'approved',
      entryId: 'entry-1',
      expiresAt: '2026-04-29T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(db.collection).toHaveBeenCalledWith('payments');
    expect(db.doc).toHaveBeenCalledWith('payment-1');
  });

  it('returns 401 when auth verification fails', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));
    getAdminFirestore.mockReturnValue(createDb({ exists: false }));

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for missing payments', async () => {
    getAdminFirestore.mockReturnValue(createDb({ exists: false }));

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({ error: 'Pagamento nao encontrado' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when a user tries to read another user payment', async () => {
    getAdminFirestore.mockReturnValue(
      createDb({
        exists: true,
        data: () => ({
          userId: 'other-user',
          status: 'pending',
          entryId: 'entry-1',
        }),
      }),
    );

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(403);
  });
});
