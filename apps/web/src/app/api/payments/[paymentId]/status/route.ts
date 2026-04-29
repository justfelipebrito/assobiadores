import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);

    const db = getAdminFirestore();
    const paymentDoc = await db.collection('payments').doc(params.paymentId).get();

    if (!paymentDoc.exists) {
      throw new ApiError(404, 'Pagamento nao encontrado');
    }

    const payment = paymentDoc.data()!;

    // Only allow owner to check
    if (payment.userId !== decodedToken.uid) {
      throw new ApiError(403, 'Nao autorizado');
    }

    const expiresAt = payment.expiresAt?.toDate
      ? payment.expiresAt.toDate().toISOString()
      : payment.expiresAt;

    return NextResponse.json({
      status: payment.status,
      entryId: payment.entryId,
      expiresAt,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Payment status check error:', error);
    }
    const response = getErrorResponse(error, 'Erro interno');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
