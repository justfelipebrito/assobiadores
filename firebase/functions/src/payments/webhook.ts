import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { defineSecret } from 'firebase-functions/params';
import { request } from 'node:https';
import { processPaymentWebhook } from './webhook-handler';
import {
  getMercadoPagoWebhookDataId,
  verifyMercadoPagoWebhookSignature,
} from './webhook-signature';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const mpWebhookSecret = defineSecret('MP_WEBHOOK_SECRET');

function fetchMercadoPagoOrder(orderId: string, accessToken: string) {
  return new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const req = request(
      `https://api.mercadopago.com/v1/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

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
      const signatureHeader = req.get('x-signature') ?? undefined;
      const requestId = req.get('x-request-id') ?? undefined;
      const queryDataId = req.query['data.id'] as string | string[] | undefined;
      const dataId = getMercadoPagoWebhookDataId({
        queryDataId,
        body: req.body,
      });
      const isValidSignature = verifyMercadoPagoWebhookSignature({
        xSignature: signatureHeader,
        xRequestId: requestId,
        dataId,
        secret: mpWebhookSecret.value(),
      });

      if (!isValidSignature) {
        logger.warn('Mercado Pago webhook rejected because signature validation failed', {
          hasSignatureHeader: Boolean(signatureHeader),
          hasRequestId: Boolean(requestId),
          hasQueryDataId: Boolean(queryDataId),
          dataId,
          bodyAction: req.body?.action ?? null,
          bodyType: req.body?.type ?? null,
          bodyApplicationId: req.body?.application_id ?? null,
          bodyLiveMode: req.body?.live_mode ?? null,
        });
        res.status(401).send('Invalid signature');
        return;
      }

      const client = new MercadoPagoConfig({ accessToken: mpAccessToken.value() });
      const mpPayment = new MPPayment(client);
      const mpOrder = {
        get: async ({ id }: { id: string }) => {
          return fetchMercadoPagoOrder(id, mpAccessToken.value());
        },
      };

      await processPaymentWebhook({
        body: req.body,
        db: getFirestore(),
        mpPayment,
        mpOrder,
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
