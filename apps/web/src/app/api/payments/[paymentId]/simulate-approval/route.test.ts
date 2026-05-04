import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();

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

async function post(paymentId = 'payment-1') {
  const { POST } = await import('./route');

  return POST(
    new Request(`http://localhost/api/payments/${paymentId}/simulate-approval`) as never,
    {
      params: { paymentId },
    },
  );
}

describe('POST /api/payments/[paymentId]/simulate-approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = 'true';
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
  });

  it('confirms owned qualifier payments in emulator mode', async () => {
    const paymentRef = { id: 'payment-1' };
    const db = createDb({
      exists: true,
      ref: paymentRef,
      data: () => ({
        userId: 'user-1',
        status: 'pending',
        qualifierRegistrationId: 'qualifier-registration-1',
      }),
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      status: 'approved',
      qualifierRegistrationId: 'qualifier-registration-1',
    });
    expect(res.status).toBe(200);
    expect(db.batchInstance.update).toHaveBeenCalledWith(
      paymentRef,
      expect.objectContaining({ status: 'approved' }),
    );
    expect(db.batchInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-registration-1' }),
      expect.objectContaining({ status: 'confirmed' }),
    );
    expect(db.batchInstance.commit).toHaveBeenCalledTimes(1);
  });

  it('is unavailable outside emulator mode', async () => {
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
    getAdminFirestore.mockReturnValue(createDb({ exists: false }));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Pagamento nao encontrado' });
    expect(res.status).toBe(404);
  });

  it('blocks users from approving another user payment', async () => {
    getAdminFirestore.mockReturnValue(
      createDb({
        exists: true,
        data: () => ({ userId: 'other-user', status: 'pending' }),
      }),
    );

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));
    getAdminFirestore.mockReturnValue(createDb({ exists: false }));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
  });
});
