import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebApiBaseUrl } from './web-api';

describe('getWebApiBaseUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_WEB_APP_URL;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_WEB_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_WEB_APP_URL = originalEnv;
    }
  });

  it('uses configured web app URL without trailing slash', () => {
    process.env.NEXT_PUBLIC_WEB_APP_URL = 'https://example.com/';
    expect(getWebApiBaseUrl()).toBe('https://example.com');
  });

  it('maps local admin port 3003 to local web API port 3002', () => {
    delete process.env.NEXT_PUBLIC_WEB_APP_URL;
    vi.stubGlobal('window', { location: { hostname: 'localhost', port: '3003' } });
    expect(getWebApiBaseUrl()).toBe('http://localhost:3002');
  });

  it('does not fall back to localhost in production', () => {
    delete process.env.NEXT_PUBLIC_WEB_APP_URL;
    vi.stubGlobal('window', {
      location: { hostname: 'assobiador-admin--assobiadores-3f0f6.us-east4.hosted.app', port: '' },
    });
    expect(getWebApiBaseUrl()).toBe('https://assobiador.com');
  });
});
