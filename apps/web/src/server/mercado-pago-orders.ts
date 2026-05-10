import { createHash } from 'crypto';
import { sanitizeMercadoPagoDeviceSessionId } from '../lib/mercado-pago-device';

export const MERCADO_PAGO_REFERENCE_MAX_LENGTH = 64;
export const MERCADO_PAGO_ITEM_EXTERNAL_CODE_MAX_LENGTH = 30;
export const MERCADO_PAGO_STATEMENT_DESCRIPTOR = 'ASSOBIADOR';

type MercadoPagoPixOrderItem = {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPriceInCents: number;
};

function getMercadoPagoAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN is not configured');
  }
  return token;
}

export class MercadoPagoOrderError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(`Mercado Pago order creation failed with status ${status}`);
  }
}

export function formatOrderAmount(amountInCents: number) {
  return (amountInCents / 100).toFixed(2);
}

export function createMercadoPagoReference(parts: Array<string | number>) {
  const reference = parts
    .map((part) => String(part).trim().toLowerCase())
    .filter(Boolean)
    .join('_')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_');

  if (reference.length <= MERCADO_PAGO_REFERENCE_MAX_LENGTH) {
    return reference;
  }

  const hash = createHash('sha256').update(reference).digest('hex').slice(0, 12);
  const prefixLength = MERCADO_PAGO_REFERENCE_MAX_LENGTH - hash.length - 1;
  return `${reference.slice(0, prefixLength).replace(/[_-]+$/g, '')}_${hash}`;
}

export function getMercadoPagoPayerEmail(email: string, idempotencyKey: string) {
  const trimmed = email.trim().toLowerCase();
  const looksUsable =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) &&
    !trimmed.endsWith('.test') &&
    !trimmed.endsWith('.invalid') &&
    !trimmed.endsWith('.localhost');

  if (looksUsable) return trimmed;

  const safeReference = idempotencyKey
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-24);
  return `payer-${safeReference}@testuser.com`;
}

export function shouldUseMercadoPagoSandboxAutoApproval(env = process.env) {
  return env.MP_SANDBOX_AUTO_APPROVE === 'true';
}

export function createMercadoPagoItemExternalCode(value: string) {
  const code = createMercadoPagoReference([value]);
  if (code.length <= MERCADO_PAGO_ITEM_EXTERNAL_CODE_MAX_LENGTH) {
    return code;
  }

  const hash = createHash('sha256').update(code).digest('hex').slice(0, 8);
  const prefixLength = MERCADO_PAGO_ITEM_EXTERNAL_CODE_MAX_LENGTH - hash.length - 1;
  return `${code.slice(0, prefixLength).replace(/[_-]+$/g, '')}_${hash}`;
}

export function createMercadoPagoOrderItem(item: MercadoPagoPixOrderItem) {
  return {
    title: item.title.trim().slice(0, 120),
    ...(item.description?.trim()
      ? { description: item.description.trim().slice(0, 250) }
      : {}),
    quantity: item.quantity,
    unit_price: formatOrderAmount(item.unitPriceInCents),
    external_code: createMercadoPagoItemExternalCode(item.id),
  };
}

export async function createMercadoPagoPixOrder({
  amountInCents,
  payerEmail,
  idempotencyKey,
  item,
  deviceSessionId,
}: {
  amountInCents: number;
  payerEmail: string;
  idempotencyKey: string;
  item: MercadoPagoPixOrderItem;
  deviceSessionId?: unknown;
}) {
  const amount = formatOrderAmount(amountInCents);
  const safePayerEmail = getMercadoPagoPayerEmail(payerEmail, idempotencyKey);
  const useSandboxAutoApproval = shouldUseMercadoPagoSandboxAutoApproval();
  const safeDeviceSessionId = sanitizeMercadoPagoDeviceSessionId(deviceSessionId);
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      'x-idempotency-key': idempotencyKey,
      ...(safeDeviceSessionId ? { 'x-meli-session-id': safeDeviceSessionId } : {}),
    },
    body: JSON.stringify({
      type: 'online',
      total_amount: amount,
      external_reference: idempotencyKey,
      processing_mode: 'automatic',
      items: [createMercadoPagoOrderItem(item)],
      payer: {
        email: useSandboxAutoApproval ? 'test@testuser.com' : safePayerEmail,
        ...(useSandboxAutoApproval ? { first_name: 'APRO' } : {}),
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: 'pix',
              type: 'bank_transfer',
              statement_descriptor: MERCADO_PAGO_STATEMENT_DESCRIPTOR,
            },
            expiration_time: 'PT30M',
          },
        ],
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new MercadoPagoOrderError(response.status, result);
  }

  const payment = result.transactions?.payments?.[0];
  const pixData = payment?.payment_method;
  if (!result.id || !payment?.id || !pixData?.qr_code_base64 || !pixData.qr_code) {
    throw new Error('Mercado Pago Pix order response is missing required payment data');
  }

  return {
    orderId: String(result.id),
    paymentId: String(payment.id),
    pixQrCode: pixData.qr_code_base64,
    pixCopiaECola: pixData.qr_code,
  };
}
