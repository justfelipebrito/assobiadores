import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { confirmPaymentTargets } from '../../../../../server/payment-confirmation';

export async function POST(req: NextRequest, { params }: { params: { paymentId: string } }) {
  try {
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') {
      throw new ApiError(404, 'Pagamento nao encontrado');
    }

    const decodedToken = await requireDecodedToken(req);
    const db = getAdminFirestore();
    const paymentDoc = await db.collection('payments').doc(params.paymentId).get();

    if (!paymentDoc.exists) {
      throw new ApiError(404, 'Pagamento nao encontrado');
    }

    const payment = paymentDoc.data()!;
    if (payment.userId !== decodedToken.uid) {
      throw new ApiError(403, 'Nao autorizado');
    }

    await confirmPaymentTargets(db, paymentDoc);

    return NextResponse.json({
      status: 'approved',
      entryId: payment.entryId,
      qualifierRegistrationId: payment.qualifierRegistrationId,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Payment test approval error:', error);
    }
    const response = getErrorResponse(error, 'Erro interno');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
