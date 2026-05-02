import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkBattleEntryEligibility } from '@batalha/utils';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';

function getMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

function getMercadoPagoAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN is not configured');
  }
  return token;
}

function formatOrderAmount(amountInCents: number) {
  return (amountInCents / 100).toFixed(2);
}

async function createMercadoPagoPixOrder({
  amountInCents,
  payerEmail,
  idempotencyKey,
}: {
  amountInCents: number;
  payerEmail: string;
  idempotencyKey: string;
}) {
  const amount = formatOrderAmount(amountInCents);
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
      payer: { email: payerEmail },
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

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const userId = decodedToken.uid;

    const body = await readJsonObject(req);
    const { battleId } = body;

    if (typeof battleId !== 'string' || !battleId) {
      throw new ApiError(400, 'battleId e obrigatorio');
    }

    const db = getAdminFirestore();

    // Fetch battle
    const battleDoc = await db.collection('battles').doc(battleId).get();
    if (!battleDoc.exists) {
      return NextResponse.json({ error: 'Batalha nao encontrada' }, { status: 404 });
    }

    const battle = battleDoc.data()!;

    const existingConfirmedEntry = await db
      .collection('battleEntries')
      .where('battleId', '==', battleId)
      .where('userId', '==', userId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();

    const eligibility = checkBattleEntryEligibility({
      status: battle.status,
      entryFee: battle.entryFee ?? 0,
      maxParticipants: battle.maxParticipants ?? 0,
      currentParticipants: battle.currentParticipants ?? 0,
      hasExistingEntry: !existingConfirmedEntry.empty,
      mode: 'paid',
    });

    if (!eligibility.allowed) {
      const status =
        eligibility.code === 'already_joined' || eligibility.code === 'battle_full' ? 409 : 400;
      return NextResponse.json(
        { error: eligibility.message || 'Nao foi possivel criar pagamento' },
        { status },
      );
    }

    const pendingPaymentQuery = await db
      .collection('payments')
      .where('battleId', '==', battleId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingPaymentQuery.empty) {
      const pendingPaymentDoc = pendingPaymentQuery.docs[0]!;
      const pendingPayment = pendingPaymentDoc.data();
      const expiresAtMillis = getMillis(pendingPayment.expiresAt);

      if (!expiresAtMillis || expiresAtMillis > Date.now()) {
        const expiresAt = pendingPayment.expiresAt?.toDate
          ? pendingPayment.expiresAt.toDate().toISOString()
          : pendingPayment.expiresAt instanceof Date
            ? pendingPayment.expiresAt.toISOString()
            : pendingPayment.expiresAt;

        return NextResponse.json({
          paymentId: pendingPaymentDoc.id,
          entryId: pendingPayment.entryId,
          pixQrCode: pendingPayment.pixQrCode,
          pixCopiaECola: pendingPayment.pixCopiaECola,
          expiresAt,
        });
      }

      const cleanupBatch = db.batch();
      cleanupBatch.update(pendingPaymentDoc.ref, {
        status: 'rejected',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (pendingPayment.entryId) {
        cleanupBatch.delete(db.collection('battleEntries').doc(pendingPayment.entryId));
      }
      await cleanupBatch.commit();
    }

    // Get user email
    const userDoc = await db.collection('users').doc(userId).get();
    const userEmail = userDoc.data()?.email || decodedToken.email || '';

    // Create battle entry
    const entryRef = db.collection('battleEntries').doc();
    const idempotencyKey = `${userId}_${battleId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const mpResult = await createMercadoPagoPixOrder({
      amountInCents: battle.entryFee,
      payerEmail: userEmail,
      idempotencyKey,
    });

    // Create payment document
    const paymentRef = db.collection('payments').doc();
    const paymentData = {
      id: paymentRef.id,
      provider: 'mercado_pago_orders',
      externalId: mpResult.orderId,
      externalPaymentId: mpResult.paymentId,
      userId,
      battleId,
      entryId: entryRef.id,
      amount: battle.entryFee,
      status: 'pending',
      pixQrCode: mpResult.pixQrCode,
      pixCopiaECola: mpResult.pixCopiaECola,
      idempotencyKey,
      webhookReceivedAt: null,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Create entry document
    const entryData = {
      id: entryRef.id,
      battleId,
      userId,
      paymentId: paymentRef.id,
      status: 'pending_payment',
      createdAt: FieldValue.serverTimestamp(),
    };

    // Batch write
    const batch = db.batch();
    batch.set(paymentRef, paymentData);
    batch.set(entryRef, entryData);
    await batch.commit();

    return NextResponse.json({
      paymentId: paymentRef.id,
      entryId: entryRef.id,
      pixQrCode: paymentData.pixQrCode,
      pixCopiaECola: paymentData.pixCopiaECola,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Payment creation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao criar pagamento. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
