import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type AdminStorageBucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

let app: App;
let auth: Auth;
let db: Firestore;
let bucket: AdminStorageBucket;

function isUsingFirebaseEmulators() {
  return (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
  );
}

function getProjectId() {
  if (isUsingFirebaseEmulators()) {
    return process.env.GCLOUD_PROJECT || 'demo-batalha';
  }

  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-batalha'
  );
}

function configureAdminEmulators() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
  process.env.GCLOUD_PROJECT ||= getProjectId();
}

function getAdminApp(): App {
  if (!app) {
    if (getApps().length === 0) {
      if (isUsingFirebaseEmulators()) {
        configureAdminEmulators();
        app = initializeApp({
          projectId: getProjectId(),
          storageBucket: `${getProjectId()}.appspot.com`,
        });
      } else {
        app = initializeApp({
          storageBucket:
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${getProjectId()}.appspot.com`,
          credential: cert({
            projectId: getProjectId(),
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
    } else {
      app = getApps()[0]!;
    }
  }
  return app;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    auth = getAuth(getAdminApp());
  }
  return auth;
}

export function getAdminFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getAdminApp());
  }
  return db;
}

export function getAdminStorageBucket(): AdminStorageBucket {
  if (!bucket) {
    bucket = getStorage(getAdminApp()).bucket();
  }
  return bucket;
}
