import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const mpFetch = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

function createDb(paymentDoc: any) {
  const batch = {
    update: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(),
  };
  const get = vi.fn(async () => paymentDoc);
  const refs: Record<string, unknown> = {};
  const doc = vi.fn((id: string) => {
    refs[id] ||= {
      id,
      get:
        id === 'qualifier-registration-1'
          ? vi.fn(async () => ({
              data: () => ({
                userId: 'user-1',
                seasonId: 'season-2026',
                category: 'freestyle',
                region: 'SP',
              }),
            }))
          : get,
    };
    return refs[id];
  });
  const collection = vi.fn(() => ({ doc }));

  return { collection, doc, get, batch: vi.fn(() => batch), batchInstance: batch };
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
    vi.stubGlobal('fetch', mpFetch);
    process.env.MP_ACCESS_TOKEN = 'test-token';
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    mpFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'action_required', status_detail: 'waiting_transfer' }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('polls Mercado Pago Orders API and confirms pending owner payments', async () => {
    const paymentRef = { update: vi.fn() };
    const db = createDb({
      exists: true,
      ref: paymentRef,
      data: () => ({
        id: 'payment-1',
        provider: 'mercado_pago_orders',
        externalId: 'order-1',
        userId: 'user-1',
        status: 'pending',
        entryId: 'entry-1',
        battleId: 'battle-1',
        expiresAt: { toDate: () => new Date('2026-04-29T00:00:00.000Z') },
      }),
    });
    getAdminFirestore.mockReturnValue(db);
    mpFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'processed',
        transactions: { payments: [{ status_detail: 'accredited' }] },
      }),
    });

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({
      status: 'approved',
      entryId: 'entry-1',
      expiresAt: '2026-04-29T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(mpFetch).toHaveBeenCalledWith('https://api.mercadopago.com/v1/orders/order-1', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer test-token',
      },
    });
    expect(db.batchInstance.update).toHaveBeenCalledTimes(3);
    expect(db.batchInstance.commit).toHaveBeenCalledTimes(1);
  });

  it('confirms qualifier registrations when qualifier payments are approved', async () => {
    const paymentRef = { update: vi.fn() };
    const db = createDb({
      exists: true,
      ref: paymentRef,
      data: () => ({
        id: 'payment-1',
        provider: 'mercado_pago_orders',
        externalId: 'order-1',
        userId: 'user-1',
        status: 'pending',
        qualifierRegistrationId: 'qualifier-registration-1',
        expiresAt: { toDate: () => new Date('2026-04-29T00:00:00.000Z') },
      }),
    });
    getAdminFirestore.mockReturnValue(db);
    mpFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'processed',
        transactions: { payments: [{ status_detail: 'accredited' }] },
      }),
    });

    const res = await getStatus();

    await expect(res.json()).resolves.toEqual({
      status: 'approved',
      expiresAt: '2026-04-29T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    expect(db.batchInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-registration-1' }),
      expect.objectContaining({ status: 'confirmed' }),
    );
    expect(db.batchInstance.commit).toHaveBeenCalledTimes(1);
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
