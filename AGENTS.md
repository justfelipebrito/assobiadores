# Project Instructions

## Testing Requirement

Every feature must include solid automated tests before it is considered complete.

- Add or update tests in the same change set as the feature or bug fix.
- Cover the behavior, authorization boundaries, validation failures, and relevant edge cases.
- For backend or security-sensitive work, include negative tests that prove unauthorized clients cannot perform protected actions.
- If a feature cannot be tested immediately because the test harness is missing, add the harness first or explicitly mark the feature incomplete in `SESSION-SUMMARY.md`.
- Do not rely on `type-check` and `build` as substitutes for behavioral tests.

## Security Requirement

Do not trust client-side checks for protected workflows.

- Enforce authorization and state transitions server-side through API routes, Cloud Functions, or Firestore rules.
- Keep Firestore rules strict for client-writable collections: validate ownership, allowed fields, immutable fields, status/phase constraints, and numeric bounds.
- Payment, points, ranks, prizes, roles, and moderation decisions must never be client-writable.

## Documentation Requirement

After every meaningful code or architecture change, update `SESSION-SUMMARY.md` with what changed, what remains, and any newly discovered risks.
