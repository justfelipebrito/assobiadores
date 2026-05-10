import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMercadoPagoItemExternalCode,
  createMercadoPagoOrderItem,
  createMercadoPagoReference,
  createMercadoPagoPixOrder,
  getMercadoPagoPayerEmail,
  MERCADO_PAGO_ITEM_EXTERNAL_CODE_MAX_LENGTH,
  MERCADO_PAGO_REFERENCE_MAX_LENGTH,
  MERCADO_PAGO_STATEMENT_DESCRIPTOR,
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

describe('createMercadoPagoOrderItem', () => {
  it('keeps item external codes within the Mercado Pago item limit', () => {
    const code = createMercadoPagoItemExternalCode('battle-qa-paid-battle-mp-smoke-1778198264250');

    expect(code.length).toBeLessThanOrEqual(MERCADO_PAGO_ITEM_EXTERNAL_CODE_MAX_LENGTH);
    expect(code).toMatch(/_[a-f0-9]{8}$/);
  });

  it('normalizes product quantity and unit price for Mercado Pago Orders API', () => {
    expect(
      createMercadoPagoOrderItem({
        id: 'battle:ABC',
        title: ' Entrada da batalha ',
        description: ' Taxa de inscricao ',
        quantity: 1,
        unitPriceInCents: 400,
      }),
    ).toEqual({
      title: 'Entrada da batalha',
      description: 'Taxa de inscricao',
      quantity: 1,
      unit_price: '4.00',
      external_code: 'battle-abc',
    });
  });
});

describe('createMercadoPagoPixOrder', () => {
  const mpFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mpFetch);
    process.env.MP_ACCESS_TOKEN = 'test-token';
    mpFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'order-1',
        transactions: {
          payments: [
            {
              id: 'payment-1',
              payment_method: {
                qr_code_base64: 'base64',
                qr_code: 'pix',
              },
            },
          ],
        },
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.MP_ACCESS_TOKEN;
  });

  it('sends item, statement descriptor, unit price, and valid device id to Mercado Pago', async () => {
    await createMercadoPagoPixOrder({
      amountInCents: 400,
      payerEmail: 'user@example.com',
      idempotencyKey: 'payment-key',
      deviceSessionId: 'device-123456',
      item: {
        id: 'qualifier-sp-freestyle',
        title: 'Classificatoria SP Freestyle',
        quantity: 1,
        unitPriceInCents: 400,
      },
    });

    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toMatchObject({
      authorization: 'Bearer test-token',
      'x-idempotency-key': 'payment-key',
      'x-meli-session-id': 'device-123456',
    });
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      total_amount: '4.00',
      items: [
        {
          title: 'Classificatoria SP Freestyle',
          quantity: 1,
          unit_price: '4.00',
          external_code: 'qualifier-sp-freestyle',
        },
      ],
      transactions: {
        payments: [
          {
            amount: '4.00',
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
              statement_descriptor: MERCADO_PAGO_STATEMENT_DESCRIPTOR,
            },
          },
        ],
      },
    });
  });

  it('does not forward unsafe device ids', async () => {
    await createMercadoPagoPixOrder({
      amountInCents: 400,
      payerEmail: 'user@example.com',
      idempotencyKey: 'payment-key',
      deviceSessionId: 'bad<script>',
      item: {
        id: 'battle-1',
        title: 'Battle',
        quantity: 1,
        unitPriceInCents: 400,
      },
    });

    const [, requestInit] = mpFetch.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).not.toHaveProperty('x-meli-session-id');
  });
});
