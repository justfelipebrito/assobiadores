# CI/CD

This repo uses GitHub Actions for validation and Firebase production rollout.

## Workflows

- `.github/workflows/ci.yml`
  - Runs on pull requests and pushes to `main`/`develop`.
  - Installs with pnpm on Node.js 22.
  - Runs automated tests, Firestore rules tests through the emulator, type-check, and build.

- `.github/workflows/firebase-app-hosting.yml`
  - Runs on pushes to `main` and can be triggered manually.
  - Runs the same validation gate before deploying.
  - Deploys Firestore rules/indexes and Storage rules.
  - Creates a Firebase App Hosting rollout for the configured backend.

## Required GitHub Settings

Create a `production` environment in GitHub and add these secrets:

```text
FIREBASE_SERVICE_ACCOUNT
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_GA_MEASUREMENT_ID
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT
NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT
```

Add these repository or environment variables:

```text
FIREBASE_PROJECT_ID=assobiadores-3f0f6
FIREBASE_APP_HOSTING_BACKEND_ID=assobiador-web
```

`FIREBASE_SERVICE_ACCOUNT` should be a Google service account JSON with permission to deploy
Firestore rules/indexes, Storage rules, and create App Hosting rollouts for the Firebase project.

The deployment service account has been created:

```text
Service account: github-actions-deploy@assobiadores-3f0f6.iam.gserviceaccount.com
Roles:
- roles/firebase.admin
- roles/firebaseapphosting.admin
Local key file: /private/tmp/assobiadores-github-actions-deploy.json
```

Copy the full JSON file contents into the GitHub secret named `FIREBASE_SERVICE_ACCOUNT`, then
delete the local key file after confirming the secret was saved.

## Firebase App Hosting Environment

`apps/web/apphosting.yaml` declares the public Firebase, Google Analytics, and AdSense variables as
build/runtime variables. Private runtime values remain Firebase secrets:

```text
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
MP_ACCESS_TOKEN
MP_WEBHOOK_SECRET
```

Keep local emulator runs using `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`; production deploys should
not set that variable.

## Current App Hosting Backend

Created on 2026-05-07:

```text
Backend ID: assobiador-web
Primary region: us-east4
Resource: projects/assobiadores-3f0f6/locations/us-east4/backends/assobiador-web
```

`southamerica-east1` is available for Cloud Functions in this project, but Firebase App Hosting does
not currently offer it as a primary region. Use `us-east4` for the web app until App Hosting adds a
Brazil/South America region.
