import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const mpCreate = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(function MercadoPagoConfig() {
    return {};
  }),
  Payment: vi.fn(function Payment() {
    return { create: mpCreate };
  }),
}));

function createQuerySnapshot(empty: boolean) {
  return { empty };
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
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  hasExistingEntry?: boolean;
}) {
  const battleDoc = {
    exists: battleExists,
    data: () => battle,
  };
  const userDoc = {
    data: () => ({ email: 'user@example.com' }),
  };
  const entryRef = { id: 'entry-1' };
  const paymentRef = { id: 'payment-1' };
  const existingEntryQuery = createQuery(createQuerySnapshot(!hasExistingEntry));
  const batch = {
    set: vi.fn(),
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
        return { doc: vi.fn(() => paymentRef) };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, entryRef, paymentRef, existingEntryQuery };
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
    process.env.MP_ACCESS_TOKEN = 'test-token';
    requireDecodedToken.mockResolvedValue({ uid: 'user-1', email: 'token@example.com' });
    mpCreate.mockResolvedValue({
      id: 123,
      point_of_interaction: {
        transaction_data: {
          qr_code_base64: 'base64-qr',
          qr_code: 'pix-code',
        },
      },
    });
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
    expect(mpCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        transaction_amount: 5,
        payment_method_id: 'pix',
        payer: { email: 'user@example.com' },
        description: 'Inscricao: Batalha paga',
      }),
    });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenCalledWith(
      paymentRef,
      expect.objectContaining({
        externalId: '123',
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

  it('returns 401 when auth verification fails', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
    expect(mpCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post('{');

    await expect(res.json()).resolves.toEqual({ error: 'JSON invalido' });
    expect(res.status).toBe(400);
    expect(mpCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for missing battleId', async () => {
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);

    const res = await post({});

    await expect(res.json()).resolves.toEqual({ error: 'battleId e obrigatorio' });
    expect(res.status).toBe(400);
    expect(mpCreate).not.toHaveBeenCalled();
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
    expect(mpCreate).not.toHaveBeenCalled();
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
    expect(mpCreate).not.toHaveBeenCalled();
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
    expect(mpCreate).not.toHaveBeenCalled();
  });

  it('masks Mercado Pago failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminFirestore.mockReturnValue(createDb({ battle: paidBattle }).db);
    mpCreate.mockRejectedValue(new Error('mp unavailable'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao criar pagamento. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('Payment creation error:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
