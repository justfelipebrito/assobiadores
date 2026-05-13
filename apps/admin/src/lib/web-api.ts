const PRODUCTION_WEB_APP_URL = 'https://assobiador.com';

export function getWebApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_WEB_APP_URL) {
    return process.env.NEXT_PUBLIC_WEB_APP_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://localhost:${port === '3003' ? '3002' : '3000'}`;
    }
  }

  return PRODUCTION_WEB_APP_URL;
}
