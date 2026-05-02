import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { defineSecret } from 'firebase-functions/params';
import { processPaymentWebhook } from './webhook-handler';
import { verifyMercadoPagoWebhookSignature } from './webhook-signature';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const mpWebhookSecret = defineSecret('MP_WEBHOOK_SECRET');

export const onPaymentWebhook = onRequest(
  {
    region: 'southamerica-east1',
    secrets: [mpAccessToken, mpWebhookSecret],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      const isValidSignature = verifyMercadoPagoWebhookSignature({
        xSignature: req.get('x-signature') ?? undefined,
        xRequestId: req.get('x-request-id') ?? undefined,
        dataId: req.query['data.id'] as string | string[] | undefined,
        secret: mpWebhookSecret.value(),
      });

      if (!isValidSignature) {
        logger.warn('Mercado Pago webhook rejected because signature validation failed');
        res.status(401).send('Invalid signature');
        return;
      }

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
