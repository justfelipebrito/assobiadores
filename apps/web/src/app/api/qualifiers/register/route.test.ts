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
  existingRegistration,
  existingPayment,
  userEmail = 'user@example.com',
  birthState = 'SP',
}: {
  existingRegistration?: Record<string, unknown> & { id?: string };
  existingPayment?: Record<string, unknown> & { id?: string };
  userEmail?: string;
  birthState?: string | null;
} = {}) {
  const registrationRef = {
    id: existingRegistration?.id ?? 'registration-1',
    update: vi.fn(),
  };
  const paymentRef = { id: existingPayment?.id ?? 'payment-1' };
  const qualifierTrackRef = { id: 'qualifier-sp-2026-freestyle' };
  const registrationQuery = createQuery(
    createDocsQuerySnapshot(
      existingRegistration
        ? [
            {
              id: existingRegistration.id ?? 'registration-1',
              ref: registrationRef,
              data: () => existingRegistration,
            },
          ]
        : [],
    ),
  );
  const paymentDoc = {
    id: existingPayment?.id ?? 'payment-1',
    exists: Boolean(existingPayment),
    data: () => existingPayment,
  };
  const userDoc = {
    data: () => ({ email: userEmail, birthState }),
  };
  const batch = {
    set: vi.fn(),
    commit: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'qualifierRegistrations') {
        return {
          doc: vi.fn(() => registrationRef),
          where: registrationQuery.where,
        };
      }
      if (name === 'payments') {
        return {
          doc: vi.fn(() => ({ ...paymentRef, get: vi.fn(async () => paymentDoc) })),
        };
      }
      if (name === 'qualifierTracks') {
        return { doc: vi.fn(() => qualifierTrackRef) };
      }
      if (name === 'users') {
        return { doc: vi.fn(() => ({ get: vi.fn(async () => userDoc) })) };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, registrationRef, paymentRef, qualifierTrackRef, registrationQuery };
}

async function post(body: unknown = { category: 'freestyle', region: 'SP' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/qualifiers/register', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/qualifiers/register', () => {
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

  it('creates a qualifier registration payment', async () => {
    const { db, batch, registrationRef, paymentRef, registrationQuery } = createDb();
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toMatchObject({
      paymentId: paymentRef.id,
      registrationId: registrationRef.id,
      pixQrCode: 'base64-qr',
      pixCopiaECola: 'pix-code',
    });
    expect(res.status).toBe(200);
    expect(registrationQuery.where).toHaveBeenCalledWith('category', '==', 'freestyle');
    expect(registrationQuery.where).toHaveBeenCalledWith('region', '==', 'SP');
    expect(mpFetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/v1/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-token',
          'x-idempotency-key': expect.stringMatching(/^user-1_qualifier_season-2026_sp_freestyle_/),
        }),
      }),
    );
    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    const idempotencyKey = String(
      (requestInit.headers as Record<string, string>)['x-idempotency-key'],
    );
    expect(idempotencyKey.length).toBeLessThanOrEqual(64);
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      external_reference: idempotencyKey,
    });
    expect(batch.set).toHaveBeenCalledWith(
      registrationRef,
      expect.objectContaining({
        userId: 'user-1',
        seasonId: 'season-2026',
        category: 'freestyle',
        region: 'SP',
        status: 'pending_payment',
        entryFeeCents: 400,
        paymentId: 'payment-1',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-1' }),
      expect.objectContaining({
        targetType: 'qualifier_registration',
        targetId: 'registration-1',
        qualifierRegistrationId: 'registration-1',
        amount: 400,
        status: 'pending',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-sp-2026-freestyle' }),
      expect.objectContaining({
        id: 'qualifier-sp-2026-freestyle',
        slug: 'sp-freestyle-2026',
        seasonId: 'season-2026',
        seasonYear: 2026,
        category: 'freestyle',
        region: 'SP',
        registeredCount: expect.anything(),
        pendingPaymentCount: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('uses Mercado Pago sandbox auto-approval payer when explicitly enabled', async () => {
    process.env.MP_SANDBOX_AUTO_APPROVE = 'true';
    const { db } = createDb({ userEmail: 'user@example.com' });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    expect(res.status).toBe(200);
    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body)).payer).toEqual({
      email: 'test@testuser.com',
      first_name: 'APRO',
    });
  });

  it('reuses an existing non-expired pending qualifier Pix', async () => {
    const { db, batch } = createDb({
      existingRegistration: {
        id: 'registration-1',
        status: 'pending_payment',
        paymentId: 'payment-1',
      },
      existingPayment: {
        id: 'payment-1',
        status: 'pending',
        pixQrCode: 'existing-qr',
        pixCopiaECola: 'existing-pix',
        expiresAt: { toDate: () => new Date(Date.now() + 60_000) },
      },
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toMatchObject({
      paymentId: 'payment-1',
      registrationId: 'registration-1',
      pixQrCode: 'existing-qr',
      pixCopiaECola: 'existing-pix',
    });
    expect(res.status).toBe(200);
    expect(mpFetch).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('does not create another Pix for a confirmed category registration', async () => {
    const { db } = createDb({
      existingRegistration: {
        id: 'registration-1',
        status: 'confirmed',
        paymentId: 'payment-1',
      },
    });
    getAdminFirestore.mockReturnValue(db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error:
        'Sua inscricao ja esta confirmada nesta categoria. Escolha outra categoria para gerar um novo Pix.',
    });
    expect(res.status).toBe(409);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('rejects invalid category input', async () => {
    getAdminFirestore.mockReturnValue(createDb().db);

    const res = await post({ category: 'beatbox' });

    await expect(res.json()).resolves.toEqual({
      error: 'Categoria e obrigatoria',
    });
    expect(res.status).toBe(400);
  });

  it('requires naturalidade from the user profile', async () => {
    getAdminFirestore.mockReturnValue(createDb({ birthState: null }).db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Complete sua naturalidade no perfil para entrar nas classificatorias',
    });
    expect(res.status).toBe(400);
    expect(mpFetch).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));
    getAdminFirestore.mockReturnValue(createDb().db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
  });

  it('logs Mercado Pago rejected order response details server-side', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminFirestore.mockReturnValue(createDb().db);
    mpFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid payer', error: 'bad_request' }),
    });

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento da classificatoria',
    });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith(
      'Qualifier registration Mercado Pago order rejected:',
      JSON.stringify({
        status: 400,
        responseBody: { message: 'Invalid payer', error: 'bad_request' },
      }),
    );
    errorSpy.mockRestore();
  });
});
