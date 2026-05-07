# Manual QA With Firebase Emulators

Use this workflow to test the app in a browser without writing to production Firebase.

## Start Local Services

In terminal 1:

```bash
pnpm emulators
```

In terminal 2, seed fake local data:

```bash
pnpm seed:emulator
```

In terminal 3, run the web app against emulators:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true pnpm --filter web dev
```

In terminal 4, run the admin app against emulators when testing moderation/admin flows:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true NEXT_PUBLIC_WEB_APP_URL=http://localhost:3000 pnpm --filter admin dev
```

Open:

- Web app: `http://localhost:3000`
- Admin app: `http://localhost:3001`
- Firebase Emulator UI: `http://127.0.0.1:4000`

If port `3000` is busy, run:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true pnpm --filter web exec next dev --port 3002
```

## Test Accounts

- User: `user@example.test` / `password123`
- Voter: `voter@example.test` / `password123`
- Admin: `admin@example.test` / `password123`

These accounts exist only in the local Auth emulator after running `pnpm seed:emulator`.

## Suggested Smoke Test

1. Log in as `user@example.test`.
2. Open `/batalhas`.
3. Open `Batalha Local Gratis`.
4. Join the free battle.
5. Verify in Emulator UI that `battleEntries` has a confirmed entry and the battle participant count increased.
6. Open `Batalha Local Paga`.
7. Try paid flow. Without valid Mercado Pago sandbox credentials, payment creation should fail gracefully.
8. Inspect Firestore writes in Emulator UI.

## Phase 5 Submission, Moderation, Voting, Results QA

The seed script creates deterministic Phase 5 fixtures:

- `battle-active-submit` - active battle with confirmed entries for `user-local` and `voter-local`.
- `battle-voting-open` - voting battle with approved/rejected submissions and existing vote counts.
- `submission-active-reported` - active audio submission with an open moderation report.

### Submission Flow

1. Log in to the web app as `user@example.test`.
2. Open `/batalhas/battle-active-submit/enviar`.
3. Record an on-platform audio entry up to 2 minutes.
4. Expect a success message and a new `submissions` document with `status: approved`, `mediaType: audio`, and Storage media metadata.
5. Submit again for the same battle.
6. Expect a duplicate-submission error instead of a second document.
7. Try submitting without recording audio.
8. Expect a validation error and no new document.

### Admin Moderation Flow

1. Log in to the admin app as `admin@example.test`.
2. Open `http://localhost:3001/moderacao`.
3. Confirm `submission-active-reported` appears in open reports.
4. Remove the reported submission.
5. Verify in Emulator UI that the submission `status` changed to `removed` and `removedBy`/`updatedAt` were refreshed.
6. Confirm the removed item no longer appears as an active moderation item.

### Voting Flow

1. Log in to the web app as `user@example.test`.
2. Open `/batalhas/battle-voting-open/votar`.
3. Vote for `submission-voting-voter`.
4. Verify in Emulator UI that a new `votes` document was created and `submission-voting-voter.voteCount` incremented.
5. Try voting again in the same battle.
6. Expect the duplicate-vote error.
7. Log in as `voter@example.test` and try voting for `submission-voting-voter`.
8. Expect the self-vote prevention error.

### Results Flow

1. Open `/batalhas/battle-voting-open/resultado`.
2. Confirm only approved submissions are shown.
3. Confirm the list is ordered by `voteCount` descending.

## Reset Data

Stop and restart `pnpm emulators`, then run:

```bash
pnpm seed:emulator
```

The emulator database is disposable. Never use production Firebase projects for exploratory manual QA.

## Required Environment

For emulator browser QA:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

For paid Pix sandbox QA, also set the Mercado Pago sandbox access token in `apps/web/.env.local`:

```bash
MP_ACCESS_TOKEN=your-sandbox-capable-access-token
```

Validate the token and Orders API Pix creation without printing secrets:

```bash
pnpm validate:mp
pnpm validate:mp:order
```

The Orders API validator must report `hasQr: true` and `hasCopyPaste: true`. If it creates an order
without those fields, the browser Pix modal cannot be tested with that credential.

For Mercado Pago's sandbox auto-approval path, set this only in local/sandbox env:

```bash
MP_SANDBOX_AUTO_APPROVE=true
```

For temporary sandbox-domain QA on `assobiador.com`, App Hosting can expose the same flag through
`apps/web/apphosting.yaml`. Remove that runtime variable before switching to real production Mercado
Pago credentials or doing a real-money Pix smoke test.

For deployed webhook QA, also follow `docs/MERCADO-PAGO-SANDBOX.md` and configure:

```bash
firebase functions:secrets:set MP_ACCESS_TOKEN
firebase functions:secrets:set MP_WEBHOOK_SECRET
```

In the Mercado Pago dashboard, the webhook event must include **Order (Mercado Pago)**. The Pix
implementation uses Orders API, so payment-only notifications will not dispatch the event that the
deployed webhook expects.
