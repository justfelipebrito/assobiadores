import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildMercadoPagoSignatureManifest,
  getMercadoPagoWebhookDataId,
  verifyMercadoPagoWebhookSignature,
} from './webhook-signature';

function sign(manifest: string, secret: string) {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

describe('Mercado Pago webhook signature', () => {
  it('uses query data.id first and falls back to body data.id for dashboard simulations', () => {
    expect(
      getMercadoPagoWebhookDataId({
        queryDataId: 'PAY-QUERY',
        body: { data: { id: 'ORD-BODY' } },
      }),
    ).toBe('PAY-QUERY');

    expect(
      getMercadoPagoWebhookDataId({
        body: { data: { id: 'ORDTST01KR10SCABF64HVS1TJK5NXKVS' } },
      }),
    ).toBe('ORDTST01KR10SCABF64HVS1TJK5NXKVS');
  });

  it('builds the official manifest from notification fields', () => {
    expect(
      buildMercadoPagoSignatureManifest({
        dataId: 'ABC123',
        requestId: 'request-1',
        timestamp: '1704908010',
      }),
    ).toBe('id:abc123;request-id:request-1;ts:1704908010;');
  });

  it('accepts a valid x-signature header', () => {
    const secret = 'webhook-secret';
    const manifest = buildMercadoPagoSignatureManifest({
      dataId: '999999999',
      requestId: 'request-1',
      timestamp: '1704908010',
    });

    expect(
      verifyMercadoPagoWebhookSignature({
        xSignature: `ts=1704908010,v1=${sign(manifest, secret)}`,
        xRequestId: 'request-1',
        dataId: '999999999',
        secret,
      }),
    ).toBe(true);
  });

  it('accepts Mercado Pago order signatures that preserve raw uppercase order ids', () => {
    const secret = 'webhook-secret';
    const manifest = buildMercadoPagoSignatureManifest({
      dataId: 'ORDTST01KR14N2RVMX956E5SZT6B8WNV',
      requestId: 'request-1',
      timestamp: '1704908010',
      normalizeDataId: false,
    });

    expect(
      verifyMercadoPagoWebhookSignature({
        xSignature: `ts=1704908010,v1=${sign(manifest, secret)}`,
        xRequestId: 'request-1',
        dataId: 'ORDTST01KR14N2RVMX956E5SZT6B8WNV',
        secret,
      }),
    ).toBe(true);
  });

  it('rejects missing or invalid signatures', () => {
    const secret = 'webhook-secret';

    expect(
      verifyMercadoPagoWebhookSignature({
        xSignature: undefined,
        xRequestId: 'request-1',
        dataId: '999999999',
        secret,
      }),
    ).toBe(false);

    expect(
      verifyMercadoPagoWebhookSignature({
        xSignature: 'ts=1704908010,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        xRequestId: 'request-1',
        dataId: '999999999',
        secret,
      }),
    ).toBe(false);
  });
});
