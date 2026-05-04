import { describe, expect, it } from 'vitest';
import { shouldShowQualifierRegistrationNotice } from './qualifier-notice';

describe('shouldShowQualifierRegistrationNotice', () => {
  it('hides for logged out users and loading state', () => {
    expect(
      shouldShowQualifierRegistrationNotice({
        isAuthenticated: false,
        loading: false,
        registrations: [],
      }),
    ).toBe(false);

    expect(
      shouldShowQualifierRegistrationNotice({
        isAuthenticated: true,
        loading: true,
        registrations: [],
      }),
    ).toBe(false);
  });

  it('shows while the authenticated user has no active qualifier registration', () => {
    expect(
      shouldShowQualifierRegistrationNotice({
        isAuthenticated: true,
        loading: false,
        registrations: [],
      }),
    ).toBe(true);
  });

  it('hides after pending or confirmed registration exists', () => {
    expect(
      shouldShowQualifierRegistrationNotice({
        isAuthenticated: true,
        loading: false,
        registrations: [{ status: 'pending_payment' } as never],
      }),
    ).toBe(false);

    expect(
      shouldShowQualifierRegistrationNotice({
        isAuthenticated: true,
        loading: false,
        registrations: [{ status: 'confirmed' } as never],
      }),
    ).toBe(false);
  });
});
