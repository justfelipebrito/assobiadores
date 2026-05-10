'use client';

import Script from 'next/script';

export function MercadoPagoSecurityScript() {
  return (
    <Script
      src="https://www.mercadopago.com/v2/security.js"
      strategy="afterInteractive"
      data-view="checkout"
    />
  );
}
