import { describe, expect, it, vi } from 'vitest';
import { confirmPaymentTargets } from './payment-confirmation';

function createDb() {
  const refs = new Map<string, { id: string }>();
  const ref = (id: string) => {
    if (!refs.has(id)) refs.set(id, { id });
    return refs.get(id)!;
  };
  const batch = {
    update: vi.fn(),
    set: vi.fn(),
    commit: vi.fn(async () => undefined),
  };
  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ({
        ...ref(`${name}/${id}`),
        get: vi.fn(async () => ({ exists: true, data: () => ({}) })),
      })),
    })),
  };
  return { db, batch, ref };
}

describe('confirmPaymentTargets', () => {
  it('confirms paid battle entries and adds 80 percent to flexible prizes', async () => {
    const { db, batch, ref } = createDb();
    const paymentRef = ref('payments/payment-1');
    const paymentDoc = {
      ref: paymentRef,
      data: () => ({
        status: 'pending',
        amount: 500,
        battleId: 'battle-1',
        entryId: 'entry-1',
      }),
    };

    await confirmPaymentTargets(db as never, paymentDoc as never);

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining(paymentRef),
      expect.objectContaining({ status: 'approved' }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'battleEntries/entry-1' }),
      { status: 'confirmed' },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'battles/battle-1' }),
      expect.objectContaining({
        currentParticipants: expect.anything(),
        prizePool: expect.anything(),
        'prizeDistribution.first': expect.anything(),
        'prizeDistribution.second': expect.anything(),
        'prizeDistribution.third': expect.anything(),
        platformFeeTotal: expect.anything(),
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
