import { describe, expect, it, vi } from 'vitest';
import { confirmPaymentTargets } from './payment-confirmation';

function createDb({
  documents = {},
}: {
  documents?: Record<string, Record<string, unknown>>;
} = {}) {
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
    doc: vi.fn((path: string) => ({ ...ref(path), path })),
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ({
        ...ref(`${name}/${id}`),
        get: vi.fn(async () => ({
          exists: true,
          data: () => documents[`${name}/${id}`] ?? {},
        })),
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

  it('confirms qualifier registrations and writes the entry point activity', async () => {
    const { db, batch, ref } = createDb({
      documents: {
        'qualifierRegistrations/registration-1': {
          userId: 'user-1',
          seasonId: 'season-2026',
          region: 'SP',
          category: 'freestyle',
        },
        'users/user-1': {
          displayName: 'User One',
          seasonCategoryPoints: { '2026': { freestyle: { points: 25, rank: 'Iniciante' } } },
        },
      },
    });
    const paymentDoc = {
      ref: ref('payments/payment-1'),
      data: () => ({
        status: 'pending',
        amount: 400,
        qualifierRegistrationId: 'registration-1',
      }),
    };

    await confirmPaymentTargets(db as never, paymentDoc as never);

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifierRegistrations/registration-1' }),
      expect.objectContaining({ status: 'confirmed', bracketStatus: 'waiting_draw' }),
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'users/user-1' }),
      expect.objectContaining({
        points: expect.anything(),
        'seasonCategoryPoints.2026.freestyle.points': expect.anything(),
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pointActivities/qualifier__registration-1__qualifier_entry__user-1',
      }),
      expect.objectContaining({
        userId: 'user-1',
        points: 50,
        reason: 'qualifier_entry',
        sourceType: 'qualifier',
        sourceId: 'registration-1',
        category: 'freestyle',
        seasonId: '2026',
      }),
    );
  });
});
