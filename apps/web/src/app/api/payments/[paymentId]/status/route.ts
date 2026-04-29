import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@batalha/firebase/src/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } },
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]!;
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);

    const db = getAdminFirestore();
    const paymentDoc = await db.collection('payments').doc(params.paymentId).get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ error: 'Pagamento nao encontrado' }, { status: 404 });
    }

    const payment = paymentDoc.data()!;

    // Only allow owner to check
    if (payment.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 });
    }

    return NextResponse.json({ status: payment.status });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
