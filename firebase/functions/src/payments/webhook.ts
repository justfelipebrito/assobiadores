import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { defineSecret } from 'firebase-functions/params';
import { processPaymentWebhook } from './webhook-handler';

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
      const client = new MercadoPagoConfig({ accessToken: mpAccessToken.value() });
      const mpPayment = new MPPayment(client);

      await processPaymentWebhook({
        body: req.body,
        db: getFirestore(),
        mpPayment,
        logger,
      });
      res.status(200).send('OK');
    } catch (error) {
      logger.error('Webhook processing error:', error);
      // Always return 200 to prevent Mercado Pago from retrying excessively
      res.status(200).send('OK');
    }
  },
);
