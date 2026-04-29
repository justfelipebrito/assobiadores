import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@batalha/firebase/src/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]!;
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { battleId } = body;

    if (!battleId) {
      return NextResponse.json({ error: 'battleId e obrigatorio' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Fetch battle
    const battleDoc = await db.collection('battles').doc(battleId).get();
    if (!battleDoc.exists) {
      return NextResponse.json({ error: 'Batalha nao encontrada' }, { status: 404 });
    }

    const battle = battleDoc.data()!;
    if (battle.status !== 'registration') {
      return NextResponse.json({ error: 'Inscricoes encerradas' }, { status: 400 });
    }

    if (battle.entryFee <= 0) {
      return NextResponse.json({ error: 'Batalha gratuita, nao requer pagamento' }, { status: 400 });
    }

    // Check for existing confirmed entry
    const existingEntry = await db
      .collection('battleEntries')
      .where('battleId', '==', battleId)
      .where('userId', '==', userId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();

    if (!existingEntry.empty) {
      return NextResponse.json({ error: 'Voce ja esta inscrito nesta batalha' }, { status: 400 });
    }

    // Check max participants
    if (battle.maxParticipants > 0 && battle.currentParticipants >= battle.maxParticipants) {
      return NextResponse.json({ error: 'Batalha lotada' }, { status: 400 });
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
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar pagamento. Tente novamente.' },
      { status: 500 },
    );
  }
}
