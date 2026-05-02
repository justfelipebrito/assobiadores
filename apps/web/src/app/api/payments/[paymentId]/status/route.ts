import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';

function getMercadoPagoAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN is not configured');
  }
  return token;
}

interface MercadoPagoOrderStatusResponse {
  status?: string;
  status_detail?: string;
  transactions?: {
    payments?: Array<{
      status?: string;
      status_detail?: string;
    }>;
  };
}

function getOrdersApiStatus(order: MercadoPagoOrderStatusResponse) {
  const payment = order.transactions?.payments?.[0];
  const statuses = [order.status, order.status_detail, payment?.status, payment?.status_detail].filter(
    (status): status is string => typeof status === 'string',
  );

  if (statuses.some((status) => ['processed', 'approved', 'accredited'].includes(status))) {
    return 'approved';
  }

  if (
    statuses.some((status) =>
      ['rejected', 'cancelled', 'canceled', 'expired', 'failed'].includes(status),
    )
  ) {
    return 'rejected';
  }

  return 'pending';
}

async function fetchMercadoPagoOrderStatus(orderId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${getMercadoPagoAccessToken()}`,
    },
  });
  const order = await response.json();
  if (!response.ok) {
    throw new Error(`Mercado Pago order status failed with status ${response.status}`);
  }

  return getOrdersApiStatus(order);
}

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

    let status = payment.status;
    if (
      payment.status === 'pending' &&
      payment.provider === 'mercado_pago_orders' &&
      payment.externalId
    ) {
      status = await fetchMercadoPagoOrderStatus(payment.externalId);

      if (status === 'approved' && payment.status !== 'approved') {
        const batch = db.batch();
        batch.update(paymentDoc.ref, {
          status: 'approved',
          webhookReceivedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (payment.entryId) {
          batch.update(db.collection('battleEntries').doc(payment.entryId), {
            status: 'confirmed',
          });
        }
        if (payment.battleId) {
          batch.update(db.collection('battles').doc(payment.battleId), {
            currentParticipants: FieldValue.increment(1),
          });
        }
        await batch.commit();
      } else if (status === 'rejected' && payment.status !== 'rejected') {
        await paymentDoc.ref.update({
          status: 'rejected',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    const expiresAt = payment.expiresAt?.toDate
      ? payment.expiresAt.toDate().toISOString()
      : payment.expiresAt;

    return NextResponse.json({
      status,
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
