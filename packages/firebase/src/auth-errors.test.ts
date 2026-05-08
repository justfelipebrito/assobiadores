import { describe, expect, it } from 'vitest';
import { shouldFallbackToRedirect } from './auth-errors';

describe('shouldFallbackToRedirect', () => {
  it('enables redirect fallback for browser popup failures', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/popup-blocked' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/popup-closed-by-user' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/cancelled-popup-request' })).toBe(true);
    expect(
      shouldFallbackToRedirect({ code: 'auth/operation-not-supported-in-this-environment' }),
    ).toBe(true);
  });

  it('does not hide configuration or permission errors behind redirect fallback', () => {
    expect(shouldFallbackToRedirect({ code: 'auth/unauthorized-domain' })).toBe(false);
    expect(shouldFallbackToRedirect({ code: 'auth/operation-not-allowed' })).toBe(false);
    expect(shouldFallbackToRedirect(new Error('network'))).toBe(false);
  });
});
