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
    qualifierRegistration: {
      id: 'qualifier-registration-1',
      get: vi.fn(async () => ({
        data: () => ({
          userId: 'user-1',
          seasonId: 'season-2026',
          category: 'freestyle',
          region: 'SP',
        }),
      })),
    },
    qualifierTrack: { id: 'qualifier-sp-2026-freestyle' },
    qualifierParticipant: { id: 'qualifier-registration-1' },
    user: {
      id: 'user-1',
      get: vi.fn(async () => ({
        data: () => ({
          displayName: 'User One',
          seasonCategoryPoints: {
            2026: {
              freestyle: { points: 25, rank: 'Iniciante' },
            },
          },
        }),
      })),
    },
  };
  const batch = {
    update: vi.fn(),
    set: vi.fn(),
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
      if (name === 'qualifierRegistrations') {
        return {
          doc: vi.fn(() => refs.qualifierRegistration),
        };
      }
      if (name === 'qualifierTracks') {
        return {
          doc: vi.fn(() => refs.qualifierTrack),
        };
      }
      if (name === 'qualifierParticipants') {
        return {
          doc: vi.fn(() => refs.qualifierParticipant),
        };
      }
      if (name === 'users') {
        return {
          doc: vi.fn(() => refs.user),
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

  it('matches Orders API webhook payment IDs against externalPaymentId', async () => {
    const { db, batch, paymentQuery } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 987 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ status: 'approved' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: true, status: 'approved' });
    expect(paymentQuery.where).toHaveBeenCalledWith('externalPaymentId', '==', '987');
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('confirms qualifier registrations for approved payments', async () => {
    const { db, batch, refs } = createDb({
      qualifierRegistrationId: 'qualifier-registration-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 987 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => ({ status: 'approved' })),
      },
      logger,
    });

    expect(result).toEqual({ processed: true, status: 'approved' });
    expect(batch.update).toHaveBeenCalledWith(
      refs.qualifierRegistration,
      expect.objectContaining({ status: 'confirmed' }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      refs.qualifierTrack,
      expect.objectContaining({
        confirmedCount: expect.anything(),
        pendingPaymentCount: expect.anything(),
      }),
      { merge: true },
    );
    expect(batch.set).toHaveBeenCalledWith(
      refs.qualifierParticipant,
      expect.objectContaining({
        userId: 'user-1',
        displayName: 'User One',
        points: 25,
      }),
      { merge: true },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('ignores webhook events when Mercado Pago cannot return the payment', async () => {
    const { db, batch } = createDb({
      entryId: 'entry-1',
      battleId: 'battle-1',
      webhookReceivedAt: null,
    });

    const result = await processPaymentWebhook({
      body: { action: 'payment.updated', data: { id: 987 } },
      db: db as never,
      mpPayment: {
        get: vi.fn(async () => null),
      },
      logger,
    });

    expect(result).toEqual({
      processed: false,
      reason: 'mercado_pago_payment_not_found',
    });
    expect(batch.commit).not.toHaveBeenCalled();
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
