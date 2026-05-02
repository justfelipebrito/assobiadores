import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expirePendingPayments } from './expire-handler';

function createPaymentDoc(id: string, data: Record<string, unknown>) {
  return {
    ref: { id },
    data: () => data,
  };
}

function createDb({
  paymentDocs = [],
  entryStatusById = {},
}: {
  paymentDocs?: Array<ReturnType<typeof createPaymentDoc>>;
  entryStatusById?: Record<string, string | null>;
}) {
  const paymentsQuery = {
    where: vi.fn(() => paymentsQuery),
    get: vi.fn(async () => ({
      empty: paymentDocs.length === 0,
      docs: paymentDocs,
    })),
  };
  const entryRefs: Record<string, { id: string; get: ReturnType<typeof vi.fn> }> = {};
  const batch = {
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'payments') {
        return {
          where: paymentsQuery.where,
        };
      }

      if (name === 'battleEntries') {
        return {
          doc: vi.fn((id: string) => {
            const status = entryStatusById[id];
            const ref = {
              id,
              get: vi.fn(async () => ({
                exists: status !== null && status !== undefined,
                data: () => (status ? { status } : undefined),
              })),
            };
            entryRefs[id] = ref;
            return ref;
          }),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, entryRefs, paymentsQuery };
}

const logger = {
  info: vi.fn(),
};

describe('expirePendingPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when there are no expired pending payments', async () => {
    const { db, batch } = createDb({});
    const now = { seconds: 1 } as never;

    await expect(expirePendingPayments({ db: db as never, now, logger })).resolves.toEqual({
      expiredCount: 0,
    });
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('marks expired payments rejected and deletes pending entries', async () => {
    const now = { seconds: 1 } as never;
    const { db, batch, entryRefs } = createDb({
      paymentDocs: [
        createPaymentDoc('payment-1', {
          entryId: 'entry-1',
        }),
      ],
      entryStatusById: {
        'entry-1': 'pending_payment',
      },
    });

    await expect(expirePendingPayments({ db: db as never, now, logger })).resolves.toEqual({
      expiredCount: 1,
    });
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-1' }),
      { status: 'rejected', updatedAt: now },
    );
    expect(batch.delete).toHaveBeenCalledWith(entryRefs['entry-1']);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not delete confirmed entries for expired payments', async () => {
    const now = { seconds: 1 } as never;
    const { db, batch } = createDb({
      paymentDocs: [
        createPaymentDoc('payment-1', {
          entryId: 'entry-1',
        }),
      ],
      entryStatusById: {
        'entry-1': 'confirmed',
      },
    });

    await expirePendingPayments({ db: db as never, now, logger });

    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
