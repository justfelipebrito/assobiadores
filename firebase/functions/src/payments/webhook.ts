import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { defineSecret } from 'firebase-functions/params';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');

export const onPaymentWebhook = onRequest(
  {
    region: 'southamerica-east1',
    secrets: [mpAccessToken],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      const { action, data } = req.body;

      // Only process payment events
      if (!action || !action.startsWith('payment.')) {
        res.status(200).send('OK');
        return;
      }

      const paymentId = data?.id;
      if (!paymentId) {
        logger.warn('Webhook received without payment ID');
        res.status(200).send('OK');
        return;
      }

      logger.info(`Processing webhook for payment ${paymentId}, action: ${action}`);

      // Verify payment with Mercado Pago API
      const client = new MercadoPagoConfig({ accessToken: mpAccessToken.value() });
      const mpPayment = new MPPayment(client);
      const mpData = await mpPayment.get({ id: Number(paymentId) });

      if (!mpData || !mpData.external_reference) {
        logger.warn(`Payment ${paymentId} not found or missing external_reference`);
        res.status(200).send('OK');
        return;
      }

      const db = getFirestore();
      const externalId = String(paymentId);

      // Find our payment document by externalId
      const paymentQuery = await db
        .collection('payments')
        .where('externalId', '==', externalId)
        .limit(1)
        .get();

      if (paymentQuery.empty) {
        logger.warn(`No payment document found for externalId ${externalId}`);
        res.status(200).send('OK');
        return;
      }

      const paymentDoc = paymentQuery.docs[0]!;
      const paymentData = paymentDoc.data();

      // Idempotency check
      if (paymentData.webhookReceivedAt) {
        logger.info(`Payment ${externalId} already processed, skipping`);
        res.status(200).send('OK');
        return;
      }

      const mpStatus = mpData.status;
      const batch = db.batch();

      if (mpStatus === 'approved') {
        // Update payment
        batch.update(paymentDoc.ref, {
          status: 'approved',
          webhookReceivedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Confirm battle entry
        if (paymentData.entryId) {
          const entryRef = db.collection('battleEntries').doc(paymentData.entryId);
          batch.update(entryRef, { status: 'confirmed' });
        }

        // Increment battle participants
        if (paymentData.battleId) {
          const battleRef = db.collection('battles').doc(paymentData.battleId);
          batch.update(battleRef, {
            currentParticipants: FieldValue.increment(1),
          });
        }

        logger.info(`Payment ${externalId} approved and entry confirmed`);
      } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
        batch.update(paymentDoc.ref, {
          status: 'rejected',
          webhookReceivedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Payment ${externalId} rejected/cancelled`);
      }

      await batch.commit();
      res.status(200).send('OK');
    } catch (error) {
      logger.error('Webhook processing error:', error);
      // Always return 200 to prevent Mercado Pago from retrying excessively
      res.status(200).send('OK');
    }
  },
);
