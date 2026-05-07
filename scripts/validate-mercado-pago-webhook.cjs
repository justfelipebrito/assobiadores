#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const functionsRequire = createRequire(
  path.resolve(__dirname, '../firebase/functions/package.json'),
);
const { initializeApp, getApps, applicationDefault } = functionsRequire('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = functionsRequire('firebase-admin/firestore');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getAccessTokenCredentialContextId(token) {
  const parts = token.split('-');
  return parts[0] === 'APP_USR' && /^\d+$/.test(parts[1] ?? '') ? parts[1] : null;
}

function validateMercadoPagoTokenApp() {
  const token = requireEnv('MP_ACCESS_TOKEN');
  const tokenCredentialContextId = getAccessTokenCredentialContextId(token);
  const expectedTokenCredentialContextId =
    process.env.MP_EXPECTED_TOKEN_CONTEXT_ID || process.env.MP_EXPECTED_APP_ID || null;

  console.log(
    JSON.stringify(
      {
        mercadoPagoTokenKind: token.split('-')[0] || 'unknown',
        mercadoPagoTokenCredentialContextId: tokenCredentialContextId,
        expectedMercadoPagoTokenCredentialContextId: expectedTokenCredentialContextId,
        sameTokenCredentialContext: expectedTokenCredentialContextId
          ? tokenCredentialContextId === expectedTokenCredentialContextId
          : 'not_checked',
      },
      null,
      2,
    ),
  );

  if (
    expectedTokenCredentialContextId &&
    tokenCredentialContextId !== expectedTokenCredentialContextId
  ) {
    throw new Error(
      `MP_ACCESS_TOKEN belongs to credential context ${tokenCredentialContextId ?? 'unknown'}, but webhook QA expects ${expectedTokenCredentialContextId}. Use the access token from the intended Mercado Pago sandbox credentials.`,
    );
  }
}

function centsToAmount(amountInCents) {
  return (amountInCents / 100).toFixed(2);
}

async function createPixOrder({ amountInCents, reference }) {
  const token = requireEnv('MP_ACCESS_TOKEN');
  const amount = centsToAmount(amountInCents);
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-idempotency-key': reference,
    },
    body: JSON.stringify({
      type: 'online',
      total_amount: amount,
      external_reference: reference,
      processing_mode: 'automatic',
      payer: {
        email: 'test@testuser.com',
        first_name: 'APRO',
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

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Mercado Pago order failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const payment = body.transactions?.payments?.[0];
  const pix = payment?.payment_method;
  if (!body.id || !payment?.id || !pix?.qr_code_base64 || !pix?.qr_code) {
    throw new Error('Mercado Pago order did not return required Pix data');
  }

  return {
    orderId: String(body.id),
    paymentId: String(payment.id),
    pixQrCode: pix.qr_code_base64,
    pixCopiaECola: pix.qr_code,
  };
}

async function waitFor(predicate, { timeoutMs = 180000, intervalMs = 3000 } = {}) {
  const startedAt = Date.now();
  let lastResult = null;
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    lastResult = await predicate();
    if (lastResult?.done) return lastResult.value;
    if (attempt === 1 || attempt % 5 === 0) {
      console.log(
        JSON.stringify(
          {
            waitingForWebhook: true,
            elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
            lastState: lastResult?.value ?? null,
          },
          null,
          2,
        ),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for webhook. Last state: ${JSON.stringify(lastResult)}`);
}

async function createBattleWebhookFixture(db, runId) {
  const amount = 400;
  const userId = `${runId}-battle-user`;
  const battleId = `${runId}-battle`;
  const entryId = `${runId}-battle-entry`;
  const paymentId = `${runId}-battle-payment`;
  const order = await createPixOrder({ amountInCents: amount, reference: paymentId });
  const now = FieldValue.serverTimestamp();

  await db.collection('users').doc(userId).set({
    displayName: 'QA Webhook Battle',
    username: `${runId}-battle`,
    email: `${runId}-battle@example.test`,
    state: 'SP',
    birthState: 'SP',
    points: 0,
    xp: 0,
    qaValidation: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('battles').doc(battleId).set({
    title: 'QA Mercado Pago Webhook Battle',
    description: 'Temporary production webhook validation fixture.',
    type: 'community',
    format: 'group',
    category: 'freestyle',
    status: 'draft',
    entryFee: amount,
    prizePool: 0,
    prizeDistribution: { first: 0, second: 0, third: 0 },
    platformFeeTotal: 0,
    currentParticipants: 0,
    maxParticipants: 50,
    creatorId: userId,
    qaValidation: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('battleEntries').doc(entryId).set({
    battleId,
    userId,
    status: 'pending_payment',
    paymentId,
    qaValidation: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('payments').doc(paymentId).set({
    userId,
    battleId,
    entryId,
    amount,
    currency: 'BRL',
    provider: 'mercado_pago_orders',
    status: 'pending',
    externalId: order.orderId,
    externalPaymentId: order.paymentId,
    pixQrCode: order.pixQrCode,
    pixCopiaECola: order.pixCopiaECola,
    webhookReceivedAt: null,
    qaValidation: true,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
    createdAt: now,
    updatedAt: now,
  });

  return {
    amount,
    userId,
    battleId,
    entryId,
    paymentId,
    externalId: order.orderId,
    externalPaymentId: order.paymentId,
  };
}

async function createQualifierWebhookFixture(db, runId) {
  const amount = 400;
  const userId = `${runId}-qualifier-user`;
  const registrationId = `${runId}-qualifier-registration`;
  const paymentId = `${runId}-qualifier-payment`;
  const trackId = `qualifier-qa-${runId}-2026-freestyle`;
  const order = await createPixOrder({ amountInCents: amount, reference: paymentId });
  const now = FieldValue.serverTimestamp();

  await db.collection('users').doc(userId).set({
    displayName: 'QA Webhook Qualifier',
    username: `${runId}-qualifier`,
    email: `${runId}-qualifier@example.test`,
    state: 'SP',
    birthState: 'SP',
    points: 0,
    xp: 0,
    qaValidation: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('qualifierTracks').doc(trackId).set({
    region: `QA-${runId}`,
    category: 'freestyle',
    seasonId: 'season-2026',
    confirmedCount: 0,
    pendingPaymentCount: 1,
    qaValidation: true,
    updatedAt: now,
  });
  await db.collection('qualifierRegistrations').doc(registrationId).set({
    userId,
    region: `QA-${runId}`,
    category: 'freestyle',
    seasonId: 'season-2026',
    status: 'pending_payment',
    bracketStatus: 'pending_payment',
    paymentId,
    qaValidation: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('payments').doc(paymentId).set({
    userId,
    qualifierRegistrationId: registrationId,
    amount,
    currency: 'BRL',
    provider: 'mercado_pago_orders',
    status: 'pending',
    externalId: order.orderId,
    externalPaymentId: order.paymentId,
    pixQrCode: order.pixQrCode,
    pixCopiaECola: order.pixCopiaECola,
    webhookReceivedAt: null,
    qaValidation: true,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
    createdAt: now,
    updatedAt: now,
  });

  return {
    amount,
    userId,
    registrationId,
    paymentId,
    trackId,
    externalId: order.orderId,
    externalPaymentId: order.paymentId,
  };
}

async function deleteIfExists(ref) {
  const doc = await ref.get();
  if (doc.exists) await ref.delete();
}

async function cleanup(db, fixtures) {
  const refs = [
    db.collection('payments').doc(fixtures.battle.paymentId),
    db.collection('battleEntries').doc(fixtures.battle.entryId),
    db.collection('battles').doc(fixtures.battle.battleId),
    db.collection('users').doc(fixtures.battle.userId),
    db.collection('payments').doc(fixtures.qualifier.paymentId),
    db.collection('qualifierRegistrations').doc(fixtures.qualifier.registrationId),
    db.collection('qualifierParticipants').doc(fixtures.qualifier.registrationId),
    db.collection('qualifierTracks').doc(fixtures.qualifier.trackId),
    db.collection('users').doc(fixtures.qualifier.userId),
    db.doc(`seasonRankings/2026/users/${fixtures.qualifier.userId}`),
    db
      .collection('pointActivities')
      .doc(`qualifier__${fixtures.qualifier.registrationId}__qualifier_entry__${fixtures.qualifier.userId}`),
  ];

  for (const ref of refs) {
    await deleteIfExists(ref);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  loadEnv(path.join(root, 'apps/web/.env.local'));

  const projectId = process.env.FIREBASE_PROJECT_ID || 'assobiadores-3f0f6';
  const keep = process.argv.includes('--keep');
  const createOnly = process.argv.includes('--create-only');
  const runId = `qa-mp-webhook-${Date.now()}`;
  validateMercadoPagoTokenApp();

  if (!getApps().length) {
    initializeApp({ projectId, credential: applicationDefault() });
  }

  const db = getFirestore();
  console.log(`Creating temporary Mercado Pago webhook QA fixtures in ${projectId}...`);
  const fixtures = {
    battle: await createBattleWebhookFixture(db, runId),
    qualifier: await createQualifierWebhookFixture(db, runId),
  };
  console.log(
    JSON.stringify(
      {
        created: true,
        runId,
        battlePaymentId: fixtures.battle.paymentId,
        battleOrderId: fixtures.battle.externalId,
        qualifierPaymentId: fixtures.qualifier.paymentId,
        qualifierOrderId: fixtures.qualifier.externalId,
        note: 'Waiting for Mercado Pago to dispatch Order webhook events. This can take a few minutes.',
      },
      null,
      2,
    ),
  );

  if (createOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          projectId,
          keptForManualSimulation: true,
          battlePaymentId: fixtures.battle.paymentId,
          battleOrderId: fixtures.battle.externalId,
          qualifierPaymentId: fixtures.qualifier.paymentId,
          qualifierOrderId: fixtures.qualifier.externalId,
          nextStep:
            'Use one of the printed ORD ids as Data ID in Mercado Pago > Webhooks > Simular notificacao > Order (Mercado Pago).',
        },
        null,
        2,
      ),
    );
    return;
  }

  let result;
  try {
    result = await waitFor(async () => {
      const [battlePayment, battleEntry, battle, qualifierPayment, registration, participant, user] =
        await Promise.all([
          db.collection('payments').doc(fixtures.battle.paymentId).get(),
          db.collection('battleEntries').doc(fixtures.battle.entryId).get(),
          db.collection('battles').doc(fixtures.battle.battleId).get(),
          db.collection('payments').doc(fixtures.qualifier.paymentId).get(),
          db.collection('qualifierRegistrations').doc(fixtures.qualifier.registrationId).get(),
          db.collection('qualifierParticipants').doc(fixtures.qualifier.registrationId).get(),
          db.collection('users').doc(fixtures.qualifier.userId).get(),
        ]);

      const state = {
        battlePayment: battlePayment.data()?.status,
        battleEntry: battleEntry.data()?.status,
        battleParticipants: battle.data()?.currentParticipants,
        battlePrizePool: battle.data()?.prizePool,
        qualifierPayment: qualifierPayment.data()?.status,
        registration: registration.data()?.status,
        qualifierParticipantExists: participant.exists,
        qualifierUserPoints: user.data()?.points,
      };

      const done =
        state.battlePayment === 'approved' &&
        state.battleEntry === 'confirmed' &&
        state.battleParticipants === 1 &&
        state.battlePrizePool === 320 &&
        state.qualifierPayment === 'approved' &&
        state.registration === 'confirmed' &&
        state.qualifierParticipantExists &&
        state.qualifierUserPoints === 50;

      return { done, value: state };
    });
  } finally {
    if (!keep) {
      console.log('Cleaning temporary Mercado Pago webhook QA fixtures...');
      await cleanup(db, fixtures);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId,
        cleanedUp: !keep,
        battlePaymentId: fixtures.battle.paymentId,
        battleOrderId: fixtures.battle.externalId,
        battleExternalPaymentId: fixtures.battle.externalPaymentId,
        qualifierPaymentId: fixtures.qualifier.paymentId,
        qualifierOrderId: fixtures.qualifier.externalId,
        qualifierExternalPaymentId: fixtures.qualifier.externalPaymentId,
        verifiedState: result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
