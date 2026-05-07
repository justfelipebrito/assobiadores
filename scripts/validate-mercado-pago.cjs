#!/usr/bin/env node

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const envPath = path.join(process.cwd(), 'apps/web/.env.local');
const shouldCreateOrder = process.argv.includes('--create-order');

function readLocalEnv() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`);
  }

  const env = fs.readFileSync(envPath, 'utf8');
  const token = (env.match(/^MP_ACCESS_TOKEN=(.+)$/m) || [])[1]?.trim();
  const webhookSecret = (env.match(/^MP_WEBHOOK_SECRET=(.+)$/m) || [])[1]?.trim();

  return { token, webhookSecret };
}

function requestJson({ method = 'GET', path: requestPath, token, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.mercadopago.com',
        path: requestPath,
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          authorization: `Bearer ${token}`,
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = {};
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const { token, webhookSecret } = readLocalEnv();

  if (!token) {
    throw new Error('MP_ACCESS_TOKEN is missing in apps/web/.env.local');
  }

  const user = await requestJson({ token, path: '/users/me' });
  const userOk = user.status === 200 && Boolean(user.body.id);
  console.log(
    JSON.stringify({
      usersMe: {
        ok: userOk,
        status: user.status,
        site_id: user.body.site_id || null,
        hasNickname: Boolean(user.body.nickname),
      },
      localEnv: {
        MP_ACCESS_TOKEN: true,
        MP_WEBHOOK_SECRET: Boolean(webhookSecret),
      },
    }),
  );

  if (!userOk) process.exit(1);

  if (!shouldCreateOrder) return;

  const idempotencyKey = `assobiadores-validate-${Date.now()}`;
  const amount = '4.00';
  const order = await requestJson({
    method: 'POST',
    path: '/v1/orders',
    token,
    headers: { 'x-idempotency-key': idempotencyKey },
    body: {
      type: 'online',
      total_amount: amount,
      external_reference: idempotencyKey,
      processing_mode: 'automatic',
      payer: { email: `test_user_${Date.now()}@testuser.com` },
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: 'PT30M',
          },
        ],
      },
    },
  });

  const payment = order.body.transactions?.payments?.[0];
  const hasQr = Boolean(payment?.payment_method?.qr_code_base64);
  const hasCopyPaste = Boolean(payment?.payment_method?.qr_code);
  const orderOk =
    order.status === 201 && Boolean(order.body.id) && Boolean(payment?.id) && hasQr && hasCopyPaste;
  console.log(
    JSON.stringify({
      createPixOrder: {
        ok: orderOk,
        status: order.status,
        hasOrderId: Boolean(order.body.id),
        hasPaymentId: Boolean(payment?.id),
        mercadoPagoStatus: order.body.status || null,
        mercadoPagoStatusDetail: order.body.status_detail || null,
        paymentStatus: payment?.status || null,
        paymentStatusDetail: payment?.status_detail || null,
        hasQr,
        hasCopyPaste,
      },
    }),
  );

  if (!orderOk) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
