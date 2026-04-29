import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { checkBattleEntryEligibility } from '@batalha/utils';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';

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
    // Check for existing active entry
    const existingEntry = await db
      .collection('battleEntries')
      .where('battleId', '==', battleId)
      .where('userId', '==', userId)
      .where('status', 'in', ['pending_payment', 'confirmed'])
      .limit(1)
      .get();

    const eligibility = checkBattleEntryEligibility({
      status: battle.status,
      entryFee: battle.entryFee ?? 0,
      maxParticipants: battle.maxParticipants ?? 0,
      currentParticipants: battle.currentParticipants ?? 0,
      hasExistingEntry: !existingEntry.empty,
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

    // Get user email
    const userDoc = await db.collection('users').doc(userId).get();
    const userEmail = userDoc.data()?.email || decodedToken.email || '';

    // Create battle entry
    const entryRef = db.collection('battleEntries').doc();
    const idempotencyKey = `${userId}_${battleId}_${Date.now()}`;

    // Create Mercado Pago payment
    const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const mpPayment = new Payment(mpClient);

    const mpResult = await mpPayment.create({
      body: {
        transaction_amount: battle.entryFee / 100,
        payment_method_id: 'pix',
        payer: { email: userEmail },
        description: `Inscricao: ${battle.title}`,
        external_reference: idempotencyKey,
      },
    });

    const pixData = mpResult.point_of_interaction?.transaction_data;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Create payment document
    const paymentRef = db.collection('payments').doc();
    const paymentData = {
      id: paymentRef.id,
      externalId: String(mpResult.id),
      userId,
      battleId,
      entryId: entryRef.id,
      amount: battle.entryFee,
      status: 'pending',
      pixQrCode: pixData?.qr_code_base64 || '',
      pixCopiaECola: pixData?.qr_code || '',
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
