import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const mpFetch = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

function createQuerySnapshot(empty: boolean) {
  return { empty };
}

function createDocsQuerySnapshot(docs: unknown[] = []) {
  return {
    empty: docs.length === 0,
    docs,
  };
}

function createQuery(snapshot: unknown) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => snapshot),
  };

  return query;
}

function createDb({
  battle,
  battleExists = true,
  hasExistingEntry = false,
  pendingPayment,
  userEmail = 'user@example.com',
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  hasExistingEntry?: boolean;
  pendingPayment?: Record<string, unknown> & { id?: string };
  userEmail?: string;
}) {
  const battleDoc = {
    exists: battleExists,
    data: () => battle,
  };
  const userDoc = {
    data: () => ({ email: userEmail }),
  };
  const entryRef = { id: 'entry-1' };
  const paymentRef = { id: 'payment-1' };
  const existingEntryQuery = createQuery(createQuerySnapshot(!hasExistingEntry));
  const pendingPaymentQuery = createQuery(
    createDocsQuerySnapshot(
      pendingPayment
        ? [
            {
              id: pendingPayment.id ?? 'pending-payment-1',
              ref: { id: pendingPayment.id ?? 'pending-payment-1' },
              data: () => pendingPayment,
            },
          ]
        : [],
    ),
  );
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') {
        return { doc: vi.fn(() => ({ get: vi.fn(async () => battleDoc) })) };
      }
      if (name === 'users') {
        return { doc: vi.fn(() => ({ get: vi.fn(async () => userDoc) })) };
      }
      if (name === 'battleEntries') {
        return {
          doc: vi.fn(() => entryRef),
          where: existingEntryQuery.where,
        };
      }
      if (name === 'payments') {
        return {
          doc: vi.fn(() => paymentRef),
          where: pendingPaymentQuery.where,
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, entryRef, paymentRef, existingEntryQuery, pendingPaymentQuery };
}

async function post(body: unknown = { battleId: 'battle-1' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/payments/create', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

const paidBattle = {
  status: 'registration',
  entryFee: 500,
  maxParticipants: 10,
  currentParticipants: 2,
  title: 'Batalha paga',
};

describe('POST /api/payments/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mpFetch);
    process.env.MP_ACCESS_TOKEN = 'test-token';
    requireDecodedToken.mockResolvedValue({ uid: 'user-1', email: 'token@example.com' });
    mpFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'order-123',
        transactions: {
          payments: [
            {
              id: 'payment-123',
              payment_method: {
                qr_code_base64: 'base64-qr',
                qr_code: 'pix-code',
              },
            },
          ],
        },
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MP_SANDBOX_AUTO_APPROVE;
  });

  it('creates a Pix payment and pending battle entry for eligible paid battles', async () => {
    const { db, batch, entryRef, paymentRef } = createDb({ battle: paidBattle });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toMatchObject({
      paymentId: paymentRef.id,
      entryId: entryRef.id,
      pixQrCode: 'base64-qr',
      pixCopiaECola: 'pix-code',
    });
    expect(res.status).toBe(200);
    expect(mpFetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-token',
          'x-idempotency-key': expect.stringMatching(/^user-1_battle-1_/),
        }),
        body: expect.any(String),
      }),
    );
    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      type: 'online',
      total_amount: '5.00',
      processing_mode: 'automatic',
      external_reference: expect.stringMatching(/^user-1_battle-1_/),
      payer: { email: 'user@example.com' },
      transactions: {
        payments: [
          {
            amount: '5.00',
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: 'PT30M',
          },
        ],
      },
    });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenCalledWith(
      paymentRef,
      expect.objectContaining({
        provider: 'mercado_pago_orders',
        externalId: 'order-123',
        externalPaymentId: 'payment-123',
        userId: 'user-1',
        battleId: 'battle-1',
        entryId: 'entry-1',
        amount: 500,
        status: 'pending',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      entryRef,
      expect.objectContaining({
        battleId: 'battle-1',
        userId: 'user-1',
        paymentId: 'payment-1',
        status: 'pending_payment',
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('replaces local emulator .test emails before calling Mercado Pago', async () => {
    const { db } = createDb({ battle: paidBattle, userEmail: 'user@example.test' });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    expect(res.status).toBe(200);
    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body)).payer.email).toMatch(
      /^payer-[a-z0-9]+@testuser\.com$/,
    );
  });

  it('uses Mercado Pago sandbox auto-approval payer only when explicitly enabled', async () => {
    process.env.MP_SANDBOX_AUTO_APPROVE = 'true';
    const { db } = createDb({ battle: paidBattle, userEmail: 'user@example.com' });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    expect(res.status).toBe(200);
    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body)).payer).toEqual({
      email: 'test@testuser.com',
      first_name: 'APRO',
    });
  });

  it('returns 401 when auth verification fails', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post('{');

    await expect(res.json()).resolves.toEqual({ error: 'JSON invalido' });
    expect(res.status).toBe(400);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for missing battleId', async () => {
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post({});

    await expect(res.json()).resolves.toEqual({ error: 'battleId e obrigatorio' });
    expect(res.status).toBe(400);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('rejects free battles', async () => {
    getAdminFirestore.mockReturnValue(
      createDb({
        battle: {
          ...paidBattle,
          entryFee: 0,
        },
      }).db,
    );

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Batalha gratuita, nao requer pagamento' });
    expect(res.status).toBe(400);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('rejects duplicate active entries', async () => {
    getAdminFirestore.mockReturnValue(
      createDb({
        battle: paidBattle,
        hasExistingEntry: true,
      }).db,
    );

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Voce ja esta inscrito nesta batalha' });
    expect(res.status).toBe(409);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('returns an existing non-expired pending Pix instead of creating a duplicate', async () => {
    const { db, batch } = createDb({
      battle: paidBattle,
      pendingPayment: {
        id: 'pending-payment-1',
        entryId: 'entry-pending',
        pixQrCode: 'existing-qr',
        pixCopiaECola: 'existing-pix',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toMatchObject({
      paymentId: 'pending-payment-1',
      entryId: 'entry-pending',
      pixQrCode: 'existing-qr',
      pixCopiaECola: 'existing-pix',
    });
    expect(res.status).toBe(200);
    expect(mpFetch).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('expires an old pending Pix before creating a new one', async () => {
    const { db, batch } = createDb({
      battle: paidBattle,
      pendingPayment: {
        id: 'expired-payment-1',
        entryId: 'expired-entry',
        pixQrCode: 'old-qr',
        pixCopiaECola: 'old-pix',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    expect(res.status).toBe(200);
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'expired-payment-1' }),
      expect.objectContaining({ status: 'rejected' }),
    );
    expect(batch.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-1' }));
    expect(mpFetch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(2);
  });

  it('rejects full battles', async () => {
    getAdminFirestore.mockReturnValue(
      createDb({
        battle: {
          ...paidBattle,
          maxParticipants: 2,
          currentParticipants: 2,
        },
      }).db,
    );

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Batalha lotada' });
    expect(res.status).toBe(409);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('masks Mercado Pago failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);
    mpFetch.mockRejectedValue(new Error('mp unavailable'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('Payment creation error:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('logs Mercado Pago rejected order response details server-side', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);
    mpFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid payer', error: 'bad_request' }),
    });

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith(
      'Payment Mercado Pago order rejected:',
      JSON.stringify({
        status: 400,
        responseBody: { message: 'Invalid payer', error: 'bad_request' },
      }),
    );
    errorSpy.mockRestore();
  });

  it('masks missing Mercado Pago credentials', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.MP_ACCESS_TOKEN;
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(mpFetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Payment creation error:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('masks malformed Mercado Pago Pix responses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);
    mpFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'order-123', transactions: { payments: [] } }),
    });

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('Payment creation error:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
