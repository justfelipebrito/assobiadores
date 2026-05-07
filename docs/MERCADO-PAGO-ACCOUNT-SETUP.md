# Mercado Pago Account Setup

Use your own Mercado Pago account because you are the payment receiver for Assobiadores.

Do not share your Mercado Pago password. The code only needs application credentials and webhook secrets.

## Recommended Account Ownership

- Use the Mercado Pago account that should receive the money.
- If you currently receive as an individual, your personal account is acceptable for development and early setup.
- If Assobiadores later operates through a company/CNPJ, production credentials should be moved to that company account before launch.
- Keep sandbox/test credentials during development. Switch to production credentials only after the full Pix flow is validated.

## Create the Mercado Pago Application

1. Open Mercado Pago Developers:
   `https://www.mercadopago.com.br/developers`
2. Log in with your Mercado Pago account.
3. Open **Your integrations**.
4. Click **Create application**.
5. Name it `Assobiadores`.
6. Choose **Checkout Transparente**.
7. Choose **API de Orders**.
8. Create the application.

The app uses Mercado Pago Orders API for Pix creation. Keep the public key available for future client SDK/Brick work, but the current Pix route only needs the server-side access token.

## Get Sandbox Credentials

1. Open the `Assobiadores` application.
2. Go to **Testing** or **Test credentials**.
3. Copy the test/sandbox **Access Token** used for Orders API validation.
4. If Mercado Pago directs you to use a generated test seller account for this Orders API flow, use that seller test credential instead.

This maps to:

```bash
MP_ACCESS_TOKEN=your-sandbox-capable-access-token
```

Do not rely on the token prefix alone. Run `pnpm validate:mp:order` after setting it. Browser Pix QA
is not ready unless the validator reports both `hasQr: true` and `hasCopyPaste: true`.

## Configure Sandbox Webhook

1. Deploy the webhook function first:

   ```bash
   firebase deploy --only functions:onPaymentWebhook
   ```

2. Copy the deployed function URL. It should look like:

   ```text
   https://southamerica-east1-<project-id>.cloudfunctions.net/onPaymentWebhook
   ```

3. In the Mercado Pago application, open **Webhooks** or **Notifications**.
4. Add the deployed function URL.
5. Enable **Order (Mercado Pago)** notifications for the Orders API Pix flow.
6. Reveal/copy the webhook secret.

This maps to:

```bash
MP_WEBHOOK_SECRET=your-webhook-secret
```

## What To Provide For Development

Provide only these values:

```bash
MP_ACCESS_TOKEN=...
MP_WEBHOOK_SECRET=...
```

Also provide either:

```text
Firebase project ID
```

or:

```text
Deployed webhook URL
```

## Production Later

When sandbox validation passes:

1. Activate production credentials in the same Mercado Pago application.
2. Replace the test token with the production token in production only.
3. Confirm the production webhook URL is configured.
4. Run a small real-payment validation.

Production token shape usually differs from sandbox and must be treated as a secret:

```bash
MP_ACCESS_TOKEN=APP_USR-...
```

## Safer Collaboration Option

If you prefer not to copy credentials manually, invite a collaborator in Mercado Pago with integration permissions.

For sandbox work, the collaborator needs permission to:

- view test credentials;
- configure test webhooks;
- view/manage test accounts.

For production work later, only grant production credential/webhook permissions when we are ready to go live.
