import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkBattleEntryEligibility } from '@batalha/utils';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { createMercadoPagoPixOrder } from '../../../../server/mercado-pago-orders';
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
    if (battle.createdBy === userId) {
      throw new ApiError(403, 'Criadores nao podem participar da propria batalha');
    }
    if (battle.visibility === 'invite_only') {
      return NextResponse.json(
        { error: 'Esta batalha aceita apenas participantes convidados' },
        { status: 403 },
      );
    }

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
    const user = userDoc.data() ?? {};
    const userEmail = user.email || decodedToken.email || '';
    const userDisplayName =
      typeof user.displayName === 'string' && user.displayName.trim()
        ? user.displayName.trim()
        : typeof user.username === 'string' && user.username.trim()
          ? user.username.trim()
          : undefined;

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
      targetType: 'battle_entry',
      targetId: entryRef.id,
      battleId,
      entryId: entryRef.id,
      qualifierRegistrationId: null,
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
      ...(userDisplayName ? { userDisplayName } : {}),
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
