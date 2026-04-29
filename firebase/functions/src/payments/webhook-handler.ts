import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface MercadoPagoPaymentClient {
  get(input: { id: number }): Promise<{
    external_reference?: string | null;
    status?: string | null;
  } | null>;
}

export interface PaymentWebhookLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface PaymentWebhookBody {
  action?: string;
  data?: {
    id?: string | number;
  };
}

export async function processPaymentWebhook({
  body,
  db,
  mpPayment,
  logger,
}: {
  body: PaymentWebhookBody;
  db: Firestore;
  mpPayment: MercadoPagoPaymentClient;
  logger: PaymentWebhookLogger;
}) {
  const { action, data } = body;

  if (!action || !action.startsWith('payment.')) {
    return { processed: false, reason: 'ignored_event' };
  }

  const paymentId = data?.id;
  if (!paymentId) {
    logger.warn('Webhook received without payment ID');
    return { processed: false, reason: 'missing_payment_id' };
  }

  logger.info(`Processing webhook for payment ${paymentId}, action: ${action}`);

  const mpData = await mpPayment.get({ id: Number(paymentId) });
  if (!mpData || !mpData.external_reference) {
    logger.warn(`Payment ${paymentId} not found or missing external_reference`);
    return { processed: false, reason: 'missing_external_reference' };
  }

  const externalId = String(paymentId);
  const paymentQuery = await db
    .collection('payments')
    .where('externalId', '==', externalId)
    .limit(1)
    .get();

  if (paymentQuery.empty) {
    logger.warn(`No payment document found for externalId ${externalId}`);
    return { processed: false, reason: 'payment_not_found' };
  }

  const paymentDoc = paymentQuery.docs[0]!;
  const paymentData = paymentDoc.data();

  if (paymentData.webhookReceivedAt) {
    logger.info(`Payment ${externalId} already processed, skipping`);
    return { processed: false, reason: 'already_processed' };
  }

  const batch = db.batch();
  const mpStatus = mpData.status;

  if (mpStatus === 'approved') {
    batch.update(paymentDoc.ref, {
      status: 'approved',
      webhookReceivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paymentData.entryId) {
      const entryRef = db.collection('battleEntries').doc(paymentData.entryId);
      batch.update(entryRef, { status: 'confirmed' });
    }

    if (paymentData.battleId) {
      const battleRef = db.collection('battles').doc(paymentData.battleId);
      batch.update(battleRef, {
        currentParticipants: FieldValue.increment(1),
      });
    }

    await batch.commit();
    logger.info(`Payment ${externalId} approved and entry confirmed`);
    return { processed: true, status: 'approved' };
  }

  if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    batch.update(paymentDoc.ref, {
      status: 'rejected',
      webhookReceivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    logger.info(`Payment ${externalId} rejected/cancelled`);
    return { processed: true, status: 'rejected' };
  }

  logger.info(`Payment ${externalId} status ${mpStatus ?? 'unknown'} ignored`);
  return { processed: false, reason: 'ignored_status' };
}
