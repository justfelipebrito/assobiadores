# Mercado Pago Sandbox Validation

Use this checklist before marking Phase 4 externally validated.

For owner/account setup, see `docs/MERCADO-PAGO-ACCOUNT-SETUP.md`.

## Required Secrets

Web app payment creation:

```bash
MP_ACCESS_TOKEN=your-mercado-pago-sandbox-capable-access-token
```

Use a Mercado Pago credential intended for sandbox/test validation while validating local Pix flows.
Depending on the Mercado Pago product/dashboard path, this can be an application test credential or
a production-style credential from a Mercado Pago test seller account. Do not trust the prefix alone.
`pnpm validate:mp:order` is the source of truth: it must report `hasQr: true` and
`hasCopyPaste: true`.

For Mercado Pago's Pix auto-approval test path, set this only in local/sandbox environments:

```bash
MP_SANDBOX_AUTO_APPROVE=true
```

When enabled, the server sends Mercado Pago's documented sandbox payer marker
`email = test@testuser.com` and `first_name = APRO`. Never enable this in production.

For temporary `assobiador.com` sandbox-domain QA, `apps/web/apphosting.yaml` may set
`MP_SANDBOX_AUTO_APPROVE=true` as a runtime variable. Remove it or set it to `false` before switching
Firebase App Hosting to real production Mercado Pago credentials or running a real-money Pix test.

The Mercado Pago public key is not required by the current Pix flow because Pix creation happens
server-side through the Orders API. Keep it available for a future client-side SDK or Brick flow.

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

Current sandbox webhook URL:

```text
https://southamerica-east1-assobiadores-3f0f6.cloudfunctions.net/onPaymentWebhook
```

## Mercado Pago Dashboard

In the Mercado Pago developer dashboard:

1. Select the sandbox application.
2. Set the webhook notification URL to the deployed `onPaymentWebhook` URL.
3. Enable **Order (Mercado Pago)** notifications for the Orders API Pix flow.
   Payment notifications alone are not enough for this implementation because Pix creation uses
   `/v1/orders`; the webhook receives `order.*` events and then checks the Order status server-side.
4. Reveal/copy the webhook secret and set it as `MP_WEBHOOK_SECRET`.

## Manual Flow

Before browser QA, validate local credentials without printing secrets:

```bash
pnpm validate:mp
pnpm validate:mp:order
```

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
- The owner-only status route can also poll Mercado Pago Orders API and confirm the entry when the order becomes approved, but the production webhook is the primary async confirmation path.

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
- An authenticated `users/me` check against Mercado Pago succeeds when local credentials are present.
- The app payment route now creates Pix payments through Mercado Pago Orders API, with idempotency and a 30-minute `expiration_time`.
- The app payment status route can poll Mercado Pago Orders API and confirm the pending entry when the order is approved.
- The Orders API credential is considered valid for browser QA only when `pnpm validate:mp:order` returns QR and copia-e-cola data. Do not rely on token prefix alone.
- Added `MP_SANDBOX_AUTO_APPROVE=true` support for local/sandbox QA. With that flag, payment creation uses Mercado Pago's sandbox auto-approval payer values (`test@testuser.com` + `APRO`) while keeping production behavior unchanged.

Before marking Phase 4 externally validated:

1. Retry the paid battle browser flow with the seller test token in local env.
2. Configure the webhook/notifications topic for Orders API with **Order (Mercado Pago)** enabled.
3. Validate the webhook updates Firestore from pending to approved.

For a repeatable production webhook proof, run:

```bash
FIREBASE_PROJECT_ID=assobiadores-3f0f6 pnpm validate:mp:webhook
```

The script creates temporary `qa-mp-webhook-*` paid battle and classificatória fixtures, creates
sandbox Pix Orders, waits for webhook confirmation side effects, and deletes the temporary docs
after a successful run. It will time out if the Mercado Pago dashboard is not dispatching
**Order (Mercado Pago)** notifications. Use `--keep` only when you intentionally want to inspect the
QA docs.

Mercado Pago shows more than one identifier in this flow. The Integrations list shows the dashboard
application number, while sandbox credentials can show a different numeric context inside the
`APP_USR-...` access token. Use the Integrations application page for webhook URL/events/secrets, and
use the sandbox credentials from that same application page for Orders API requests.

For an `APP_USR-...` token, the script prints the parsed credential context before creating fixtures.
You can make that token-context check strict with:

```bash
MP_EXPECTED_TOKEN_CONTEXT_ID=your-sandbox-token-context-id \
FIREBASE_PROJECT_ID=assobiadores-3f0f6 \
pnpm validate:mp:webhook
```

If Mercado Pago does not dispatch the automatic sandbox event, create a kept fixture and use the
printed `battleOrderId` or `qualifierOrderId` in the Mercado Pago dashboard:

```bash
MP_EXPECTED_TOKEN_CONTEXT_ID=3392279113078093 \
FIREBASE_PROJECT_ID=assobiadores-3f0f6 \
pnpm validate:mp:webhook -- --create-only
```

Then click **Simular notificação**, choose the **Order (Mercado Pago)** event, and use one of the
printed `ORD...` ids as the Data ID. After simulation, inspect the matching `qa-mp-webhook-*`
payment/entry/registration docs, then clean those temporary docs.

Mercado Pago dashboard simulations may send the Order ID only in the POST body as `data.id`, not as
the query-string `data.id` used by some live notification examples. The deployed webhook accepts both
locations for signature validation.

## Current Deploy Status

As of 2026-05-03:

- `MP_ACCESS_TOKEN` is set in Firebase Secret Manager.
- `MP_WEBHOOK_SECRET` is set in Firebase Secret Manager.
- `onPaymentWebhook` is deployed to `southamerica-east1`.
- The deployed webhook supports Mercado Pago Orders API notifications by matching `order.*` events against `payments.externalId`, mapping `processed/accredited` order statuses to internal `approved`, and retaining legacy payment-event matching through `payments.externalPaymentId`.
- Qualifier fee payments use the same Orders API Pix flow with `payments.targetType = qualifier_registration`; approval confirms the linked `qualifierRegistrations` document. The Regional is derived from the user's profile `Naturalidade`, not from client input.
- Local emulator browser QA may use the test-only `Aprovar no teste` control to validate approved-payment UX. Real Mercado Pago validation still requires an actual sandbox-approved Pix payment and dashboard webhook event.
- `GET` requests return `405`, confirming the endpoint is reachable and method-gated.
- Unsigned `POST` requests return `401`, confirming signature validation is active.
- Artifact Registry cleanup policy is enabled for `southamerica-east1` with a 7-day retention window.
- Local paid payment route QA creates an Orders API Pix payment from the seeded `battle-paid-open` fixture, writes a pending `payments` doc, writes a pending `battleEntries` doc, and the owner-only status route returns the pending payment.

Local emulator users use `.test` email addresses, which Mercado Pago rejects as payer emails. The payment route replaces non-deliverable local/test email domains with a Mercado Pago-compatible `@testuser.com` payer email before calling Orders API. Real user emails are preserved.

## Test User Credential Step

Mercado Pago test users use the generated `nickname` as the login username. Use an incognito/private browser session so the real owner account is not mixed with the test account session.

1. Log out of Mercado Pago or open an incognito/private window.
2. Log in with the generated seller test user nickname and password.
3. Open Mercado Pago Developers while logged in as that seller test user.
4. Create an `Assobiadores Sandbox Seller` application if one does not already exist.
5. Choose Checkout Transparente and API de Orders for Orders API validation.
6. Copy the application's test/sandbox access token, or the test seller account credential Mercado Pago documents for the chosen Orders API flow.
7. Put that value in local env as the sandbox Orders API credential:

   ```bash
   MP_ACCESS_TOKEN=sandbox-capable-access-token
   ```

8. Retry the Orders API Pix validation.

Keep the real owner account credentials separate. The owner account creates/manages test users; the
seller/test application supplies the sandbox credentials for Orders API testing.
