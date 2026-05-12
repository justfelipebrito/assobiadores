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
- Deploys Firestore rules/indexes.
- Deploys Storage rules only when `FIREBASE_DEPLOY_STORAGE_RULES=true`.
- Deploys the configured Firebase App Hosting backend from the checked-out local source.

## Required GitHub Settings

Create a `production` environment in GitHub and add these secrets:

```text
FIREBASE_SERVICE_ACCOUNT
```

Add these repository or environment variables:

```text
FIREBASE_PROJECT_ID=assobiadores-3f0f6
FIREBASE_APP_HOSTING_BACKEND_ID=assobiador-web
FIREBASE_ADMIN_APP_HOSTING_BACKEND_ID=assobiador-admin
FIREBASE_DEPLOY_STORAGE_RULES=false
```

`FIREBASE_SERVICE_ACCOUNT` should be a Google service account JSON with permission to deploy
Firestore rules/indexes, Storage rules, and create App Hosting rollouts for the Firebase project.

The deployment service account has been created:

```text
Service account: github-actions-deploy@assobiadores-3f0f6.iam.gserviceaccount.com
Roles:
- roles/firebase.admin
- roles/firebaseapphosting.admin
- roles/iam.serviceAccountAdmin
- roles/resourcemanager.projectIamAdmin
Local key file: /private/tmp/assobiadores-github-actions-deploy.json
```

It also has `roles/iam.serviceAccountUser` on this specific runtime account:

```text
firebase-app-hosting-compute@assobiadores-3f0f6.iam.gserviceaccount.com
```

Copy the full JSON file contents into the GitHub secret named `FIREBASE_SERVICE_ACCOUNT`, then
delete the local key file after confirming the secret was saved.

## Firebase Storage Setup

The workflow does not deploy Storage rules by default because Firebase Storage must be initialized
in Firebase Console first. Enabling `firebasestorage.googleapis.com` in Google Cloud is not enough;
the Firebase project needs its default Storage bucket created through Firebase.

To finish Storage setup:

1. Open Firebase Console.
2. Go to project `assobiadores-3f0f6`.
3. Open **Build > Storage**.
4. Click **Get started**.
5. Choose the production location and create the bucket.
6. After the bucket exists, set this GitHub Actions variable:

```text
FIREBASE_DEPLOY_STORAGE_RULES=true
```

Until then, Firestore config and App Hosting rollouts can deploy normally, but production profile
photo/audio uploads will not work.

## Firebase App Hosting Environment

`apps/web/apphosting.yaml` declares the public Firebase client values directly as build/runtime
variables. These values are not secrets; Firebase authorization still depends on Auth, trusted
server APIs, Firestore rules, and Storage rules.

Google Analytics is optional and should be added to `apps/web/apphosting.yaml` once the production
ID is available. AdSense uses `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` for site review first, then
`NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT` after an approved display ad unit exists:

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT
NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT
```

Private runtime values remain Firebase App Hosting secrets:

```text
MP_ACCESS_TOKEN
MP_WEBHOOK_SECRET
```

The web app uses the App Hosting runtime service account through Google Application Default
Credentials for Firebase Admin access. Do not create or deploy Firebase Admin private-key secrets for
App Hosting unless a future environment explicitly needs key-based credentials.

After creating or rotating App Hosting secrets, grant the backend access:

```bash
firebase apphosting:secrets:grantaccess MP_ACCESS_TOKEN,MP_WEBHOOK_SECRET \
  --project assobiadores-3f0f6 \
  --backend assobiador-web \
  --location us-east4
```

Keep local emulator runs using `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`; production deploys should
not set that variable.

## Current App Hosting Backends

Public backend created on 2026-05-07:

```text
Backend ID: assobiador-web
Primary region: us-east4
Resource: projects/assobiadores-3f0f6/locations/us-east4/backends/assobiador-web
```

Admin backend created for the production admin app:

```text
Backend ID: assobiador-admin
Primary region: us-east4
Root directory: apps/admin
```

Keep the admin app on its generated Firebase App Hosting URL unless a custom admin domain is
explicitly needed. Do not mount admin routes inside `assobiador.com`; the admin app should remain a
separate backend protected by Firebase Auth and admin-role checks.

`southamerica-east1` is available for Cloud Functions in this project, but Firebase App Hosting does
not currently offer it as a primary region. Use `us-east4` for the web app until App Hosting adds a
Brazil/South America region.

The backends were created without a connected GitHub repository in Firebase Console, so CI/CD deploys
App Hosting from local source with:

```bash
firebase deploy --config firebase.apphosting.json --project assobiadores-3f0f6 --only apphosting:assobiador-web
firebase deploy --config firebase.apphosting.json --project assobiadores-3f0f6 --only apphosting:assobiador-admin
```

Keep App Hosting config at the repo root in `firebase.apphosting.json`. Using `firebase/firebase.json`
for App Hosting makes the CLI upload only the `firebase/` directory, which prevents Cloud Build from
finding `apps/web`.
