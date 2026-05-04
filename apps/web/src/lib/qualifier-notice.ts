import type { QualifierRegistration } from '@batalha/types';

export function shouldShowQualifierRegistrationNotice({
  isAuthenticated,
  loading,
  registrations,
}: {
  isAuthenticated: boolean;
  loading: boolean;
  registrations: QualifierRegistration[];
}) {
  if (!isAuthenticated || loading) return false;
  return !registrations.some((registration) =>
    ['pending_payment', 'confirmed'].includes(registration.status),
  );
}
