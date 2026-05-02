import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MercadoPagoWebhookSignatureInput {
  xSignature?: string | string[];
  xRequestId?: string | string[];
  dataId?: string | string[];
  secret: string;
}

function firstHeaderValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSignatureHeader(xSignature: string) {
  return xSignature.split(',').reduce<Record<string, string>>((parts, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
    return parts;
  }, {});
}

export function buildMercadoPagoSignatureManifest({
  dataId,
  requestId,
  timestamp,
}: {
  dataId?: string;
  requestId?: string;
  timestamp: string;
}) {
  const parts: string[] = [];

  if (dataId) {
    parts.push(`id:${dataId.toLowerCase()}`);
  }
  if (requestId) {
    parts.push(`request-id:${requestId}`);
  }
  parts.push(`ts:${timestamp}`);

  return `${parts.join(';')};`;
}

export function verifyMercadoPagoWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: MercadoPagoWebhookSignatureInput) {
  const signatureHeader = firstHeaderValue(xSignature);
  const requestId = firstHeaderValue(xRequestId);
  const notificationDataId = firstHeaderValue(dataId);

  if (!signatureHeader || !requestId || !secret) {
    return false;
  }

  const parts = parseSignatureHeader(signatureHeader);
  const timestamp = parts.ts;
  const expectedSignature = parts.v1;

  if (!timestamp || !expectedSignature) {
    return false;
  }

  const manifest = buildMercadoPagoSignatureManifest({
    dataId: notificationDataId,
    requestId,
    timestamp,
  });
  const actualSignature = createHmac('sha256', secret).update(manifest).digest('hex');

  const expected = new Uint8Array(Buffer.from(expectedSignature, 'hex'));
  const actual = new Uint8Array(Buffer.from(actualSignature, 'hex'));

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
