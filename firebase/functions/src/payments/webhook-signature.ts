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

export function getMercadoPagoWebhookDataId({
  queryDataId,
  body,
}: {
  queryDataId?: string | string[];
  body?: unknown;
}) {
  const queryValue = firstHeaderValue(queryDataId);
  if (queryValue) return queryValue;

  if (
    typeof body === 'object' &&
    body !== null &&
    'data' in body &&
    typeof (body as { data?: unknown }).data === 'object' &&
    (body as { data?: unknown }).data !== null &&
    'id' in ((body as { data: Record<string, unknown> }).data)
  ) {
    const bodyDataId = (body as { data: { id?: unknown } }).data.id;
    if (typeof bodyDataId === 'string' || typeof bodyDataId === 'number') {
      return String(bodyDataId);
    }
  }

  return undefined;
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
  normalizeDataId = true,
}: {
  dataId?: string;
  requestId?: string;
  timestamp: string;
  normalizeDataId?: boolean;
}) {
  const parts: string[] = [];

  if (dataId) {
    parts.push(`id:${normalizeDataId ? dataId.toLowerCase() : dataId}`);
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

  const manifests = [
    buildMercadoPagoSignatureManifest({
      dataId: notificationDataId,
      requestId,
      timestamp,
    }),
  ];

  const rawManifest = buildMercadoPagoSignatureManifest({
    dataId: notificationDataId,
    requestId,
    timestamp,
    normalizeDataId: false,
  });
  if (rawManifest !== manifests[0]) {
    manifests.push(rawManifest);
  }

  const expected = new Uint8Array(Buffer.from(expectedSignature, 'hex'));

  return manifests.some((manifest) => {
    const actualSignature = createHmac('sha256', secret).update(manifest).digest('hex');
    const actual = new Uint8Array(Buffer.from(actualSignature, 'hex'));

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
}
