import { describe, expect, it } from 'vitest';
import { qualifierRegistrationSchema } from './championship';

const timestamp = new Date('2026-06-30T12:00:00.000Z');

function baseRegistration() {
  return {
    id: 'registration-1',
    userId: 'user-1',
    seasonId: 'season-2026',
    category: 'freestyle',
    region: 'SP',
    status: 'confirmed',
    entryFeeCents: 400,
    platformFeePercent: 20,
    prizePoolPercent: 80,
    paymentId: 'payment-1',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('championship qualifier schemas', () => {
  it('keeps Pix-backed qualifier registrations typed with a nullable ticket id', () => {
    const parsed = qualifierRegistrationSchema.parse(baseRegistration());

    expect(parsed.paymentId).toBe('payment-1');
    expect(parsed.ticketId).toBeNull();
  });

  it('supports ticket-backed qualifier registrations without Pix payment ids', () => {
    const parsed = qualifierRegistrationSchema.parse({
      ...baseRegistration(),
      paymentId: null,
      ticketId: 'ticket-1',
    });

    expect(parsed.paymentId).toBeNull();
    expect(parsed.ticketId).toBe('ticket-1');
  });
});
