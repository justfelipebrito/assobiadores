import { describe, expect, it } from 'vitest';
import { sanitizeMercadoPagoDeviceSessionId } from './mercado-pago-device';

describe('sanitizeMercadoPagoDeviceSessionId', () => {
  it('accepts Mercado Pago compatible device session ids', () => {
    expect(sanitizeMercadoPagoDeviceSessionId(' abc-123_DEF.456:789 ')).toBe(
      'abc-123_DEF.456:789',
    );
  });

  it('rejects missing, short, oversized, and unsafe values', () => {
    expect(sanitizeMercadoPagoDeviceSessionId(undefined)).toBeNull();
    expect(sanitizeMercadoPagoDeviceSessionId('short')).toBeNull();
    expect(sanitizeMercadoPagoDeviceSessionId('a'.repeat(257))).toBeNull();
    expect(sanitizeMercadoPagoDeviceSessionId('valid-id<script>')).toBeNull();
  });
});
