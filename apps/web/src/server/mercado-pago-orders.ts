function getMercadoPagoAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN is not configured');
  }
  return token;
}

export function formatOrderAmount(amountInCents: number) {
  return (amountInCents / 100).toFixed(2);
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

export async function createMercadoPagoPixOrder({
  amountInCents,
  payerEmail,
  idempotencyKey,
}: {
  amountInCents: number;
  payerEmail: string;
  idempotencyKey: string;
}) {
  const amount = formatOrderAmount(amountInCents);
  const safePayerEmail = getMercadoPagoPayerEmail(payerEmail, idempotencyKey);
  const useSandboxAutoApproval = shouldUseMercadoPagoSandboxAutoApproval();
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      type: 'online',
      total_amount: amount,
      external_reference: idempotencyKey,
      processing_mode: 'automatic',
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
            },
            expiration_time: 'PT30M',
          },
        ],
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Mercado Pago order creation failed with status ${response.status}`);
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
