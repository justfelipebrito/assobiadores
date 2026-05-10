export const MERCADO_PAGO_DEVICE_SESSION_ID_MAX_LENGTH = 256;

declare global {
  interface Window {
    MP_DEVICE_SESSION_ID?: unknown;
  }
}

export function sanitizeMercadoPagoDeviceSessionId(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (
    trimmed.length < 8 ||
    trimmed.length > MERCADO_PAGO_DEVICE_SESSION_ID_MAX_LENGTH ||
    !/^[A-Za-z0-9._:-]+$/.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

export function getMercadoPagoDeviceSessionId() {
  if (typeof window === 'undefined') return null;
  return sanitizeMercadoPagoDeviceSessionId(window.MP_DEVICE_SESSION_ID);
}
