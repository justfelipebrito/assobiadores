import { describe, expect, it } from 'vitest';
import {
  createMercadoPagoReference,
  getMercadoPagoPayerEmail,
  MERCADO_PAGO_REFERENCE_MAX_LENGTH,
} from './mercado-pago-orders';

describe('createMercadoPagoReference', () => {
  it('keeps short references readable', () => {
    expect(createMercadoPagoReference(['user-1', 'battle', 'battle-1', 1778123456789])).toBe(
      'user-1_battle_battle-1_1778123456789',
    );
  });

  it('keeps Mercado Pago references within the Orders API limit', () => {
    const reference = createMercadoPagoReference([
      'vmkTmQPTsIcXoVkoGzDpUWXIwIm1',
      'qualifier',
      'season-2026',
      'SP',
      'freestyle',
      1778123456789,
    ]);

    expect(reference.length).toBeLessThanOrEqual(MERCADO_PAGO_REFERENCE_MAX_LENGTH);
    expect(reference).toMatch(/_[a-f0-9]{12}$/);
  });

  it('uses different hash suffixes for different long references', () => {
    const first = createMercadoPagoReference([
      'vmkTmQPTsIcXoVkoGzDpUWXIwIm1',
      'qualifier',
      'season-2026',
      'SP',
      'freestyle',
      1778123456789,
    ]);
    const second = createMercadoPagoReference([
      'vmkTmQPTsIcXoVkoGzDpUWXIwIm1',
      'qualifier',
      'season-2026',
      'SP',
      'freestyle',
      1778123456790,
    ]);

    expect(first).not.toBe(second);
  });
});

describe('getMercadoPagoPayerEmail', () => {
  it('builds fallback test emails from the safe reference', () => {
    const email = getMercadoPagoPayerEmail(
      'user@example.test',
      createMercadoPagoReference([
        'vmkTmQPTsIcXoVkoGzDpUWXIwIm1',
        'qualifier',
        'season-2026',
        'SP',
        'freestyle',
        1778123456789,
      ]),
    );

    expect(email).toMatch(/^payer-[a-z0-9]+@testuser\.com$/);
    expect(email.length).toBeLessThanOrEqual(64);
  });
});
