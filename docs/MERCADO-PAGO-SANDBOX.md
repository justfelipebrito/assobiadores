# Mercado Pago Sandbox Validation

Use this checklist before marking Phase 4 externally validated.

For owner/account setup, see `docs/MERCADO-PAGO-ACCOUNT-SETUP.md`.

## Required Secrets

Web app payment creation:

```bash
MP_ACCESS_TOKEN=APP_USR-your-seller-test-user-token
```

The Mercado Pago public key is not required by the current Pix flow because Pix creation happens server-side through the Orders API. Keep it available for a future client-side SDK or Brick flow.

Cloud Function webhook:

```bash
firebase functions:secrets:set MP_ACCESS_TOKEN
firebase functions:secrets:set MP_WEBHOOK_SECRET
```

`MP_WEBHOOK_SECRET` is the webhook secret shown in the Mercado Pago developer dashboard for the configured application.

## Deploy Target

Deploy the webhook function before configuring Mercado Pago notifications:

```bash
firebase deploy --only functions:onPaymentWebhook
```

The deployed webhook URL must point to:

```text
https://<region>-<project-id>.cloudfunctions.net/onPaymentWebhook
```

This project uses region `southamerica-east1`.

## Mercado Pago Dashboard

In the Mercado Pago developer dashboard:

1. Select the sandbox application.
2. Set the webhook notification URL to the deployed `onPaymentWebhook` URL.
3. Enable payment notifications.
4. Reveal/copy the webhook secret and set it as `MP_WEBHOOK_SECRET`.

## Manual Flow

1. Seed or create a paid battle with `status = registration` and `entryFee > 0`.
2. Sign in as a regular user.
3. Open `/batalhas/{battleId}/participar`.
4. Continue to `/batalhas/{battleId}/pagamento`.
5. Generate the Pix.
6. Confirm the page shows QR code, copia-e-cola, expiration countdown, and manual status check.
7. Complete/approve the sandbox payment.
8. Confirm Firestore:
   - `payments/{paymentId}.status` becomes `approved`.
   - `battleEntries/{entryId}.status` becomes `confirmed`.
   - `battles/{battleId}.currentParticipants` increments once.
   - Replayed webhook notifications do not increment participants again.

## Expected Security Behavior

- Client users cannot write `payments` or `battleEntries` directly.
- Payment status can only be read by the payment owner.
- Webhook requests without a valid Mercado Pago `x-signature`/`x-request-id` pair are rejected before any Firestore update.
- While webhook migration is pending, the owner-only status route can poll Mercado Pago Orders API and confirm the entry when the order becomes approved.

## Current Local Coverage

Automated tests cover:

- paid battle eligibility checks;
- duplicate confirmed entry rejection;
- pending Pix idempotency;
- expired pending Pix cleanup;
- Mercado Pago Orders API creation failures;
- missing `MP_ACCESS_TOKEN`;
- malformed Pix responses;
- owner-only Orders API status polling;
- webhook approved/rejected/idempotent/ignored status paths;
- webhook signature verification;
- Firestore rules blocking client-owned payment writes.

## Current Sandbox Status

As of 2026-05-02:

- A Mercado Pago sandbox seller/buyer test user pair has been created. Their passwords are intentionally not stored in this repository.
- The seller test user `APP_USR-...` access token has been configured locally in `apps/web/.env.local`.
- An authenticated `users/me` check against Mercado Pago succeeds for the seller test token.
- Direct Pix creation against `/v1/orders` succeeds and returns QR code, Pix copia-e-cola, and ticket URL.
- The app payment route now creates Pix payments through Mercado Pago Orders API, with idempotency and a 30-minute `expiration_time`.
- The app payment status route can poll Mercado Pago Orders API and confirm the pending entry when the order is approved.
- Direct Pix creation against legacy `/v1/payments` is intentionally not used for this seller test token; Mercado Pago rejects it as live-credential usage.

Before marking Phase 4 externally validated:

1. Retry the paid battle browser flow with the seller test token in local env.
2. Configure the webhook/notifications topic for Orders API.
3. Validate the webhook updates Firestore from pending to approved.

## Test User Credential Step

Mercado Pago test users use the generated `nickname` as the login username. Use an incognito/private browser session so the real owner account is not mixed with the test account session.

1. Log out of Mercado Pago or open an incognito/private window.
2. Log in with the generated seller test user nickname and password.
3. Open Mercado Pago Developers while logged in as that seller test user.
4. Create an `Assobiadores Sandbox Seller` application if one does not already exist.
5. Choose Checkout Transparente and API de Orders for Orders API validation.
6. Copy the seller test user's production-style access token. It should normally start with `APP_USR-...`.
7. Put that value in local env as the sandbox Orders API credential:

   ```bash
   MP_ACCESS_TOKEN=APP_USR-test-user-token
   ```

8. Retry the Orders API Pix validation.

Keep the real owner account credentials separate. The owner account creates/manages test users; the seller test account supplies the sandbox seller credentials for Orders API testing.
