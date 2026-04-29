import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processPaymentWebhook } from './webhook-handler';

function createQuerySnapshot(data?: Record<string, unknown>) {
  return {
    empty: !data,
    docs: data
      ? [
          {
            ref: { id: 'payment-doc' },
            data: () => data,
          },
        ]
      : [],
  };
}

function createDb(paymentData?: Record<string, unknown>) {
  const paymentQuery = {
    where: vi.fn(() => paymentQuery),
    limit: vi.fn(() => paymentQuery),
    get: vi.fn(async () => createQuerySnapshot(paymentData)),
  };
  const refs = {
    entry: { id: 'entry-1' },
    battle: { id: 'battle-1' },
  };
  const batch = {
    update: vi.fn(),
    commit: vi.fn(),
  };
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'payments') {
        return {
          where: paymentQuery.where,
        };
      }
      if (name === 'battleEntries') {
        return {
          doc: vi.fn(() => refs.entry),
        };
      }
      if (name === 'battles') {
        return {
          doc: vi.fn(() => refs.battle),
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn(() => batch),
  };

  return { db, batch, refs, paymentQuery };
}

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

describe('processPaymentWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-payment events', async () => {
    const { db, batch } = createDb();

    await expect(
      processPaymentWebhook({
        body: { action: 'merchant_order.created' },
        db: db as never,
        mpPayment: { get: vi.fn() },
        logger,
      }),
    ).resolves.toEqual({ processed: false, reason: 'ignored_event' });
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('confirms entry and increments battle participants for approved payments', async () => {
    const { db, batch, refs } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 123 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ external_reference: 'ref-1', status: 'approved' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: true, status: 'approved' });
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-doc' }),
      expect.objectContaining({ status: 'approved' }),
    );
    expect(batch.update).toHaveBeenCalledWith(refs.entry, { status: 'confirmed' });
    expect(batch.update).toHaveBeenCalledWith(
      refs.battle,
      expect.objectContaining({ currentParticipants: expect.anything() }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('marks rejected Mercado Pago statuses as rejected', async () => {
    const { db, batch } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 123 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ external_reference: 'ref-1', status: 'cancelled' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: true, status: 'rejected' });
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-doc' }),
      expect.objectContaining({ status: 'rejected' }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not process the same payment twice', async () => {
    const { db, batch } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: { seconds: 1 },
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 123 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ external_reference: 'ref-1', status: 'approved' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: false, reason: 'already_processed' });
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('ignores unknown Mercado Pago statuses without committing an empty batch', async () => {
    const { db, batch } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 123 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ external_reference: 'ref-1', status: 'pending' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: false, reason: 'ignored_status' });
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
