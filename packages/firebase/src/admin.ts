import { initializeApp, getApps, cert, type App, type AppOptions } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type AdminStorageBucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

let app: App;
let auth: Auth;
let db: Firestore;
let bucket: AdminStorageBucket;

function isUsingFirebaseEmulators(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' ||
    Boolean(env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(env.FIREBASE_AUTH_EMULATOR_HOST) ||
    Boolean(env.FIREBASE_STORAGE_EMULATOR_HOST)
  );
}

function getProjectId(env: NodeJS.ProcessEnv = process.env) {
  if (isUsingFirebaseEmulators(env)) {
    return env.GCLOUD_PROJECT || 'demo-batalha';
  }

  return env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || 'demo-batalha';
}

function configureAdminEmulators() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
  process.env.GCLOUD_PROJECT ||= getProjectId();
}

export function buildAdminAppOptions(env: NodeJS.ProcessEnv = process.env): AppOptions {
  const projectId = getProjectId(env);
  const storageBucket = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

  if (isUsingFirebaseEmulators(env)) {
    return {
      projectId,
      storageBucket,
    };
  }

  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (clientEmail || privateKey) {
    if (!clientEmail || !privateKey) {
      throw new Error('FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY must be set together.');
    }

    return {
      storageBucket,
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    };
  }

  return { storageBucket };
}

function getAdminApp(): App {
  if (!app) {
    if (getApps().length === 0) {
      if (isUsingFirebaseEmulators()) {
        configureAdminEmulators();
        app = initializeApp(buildAdminAppOptions());
      } else {
        app = initializeApp(buildAdminAppOptions());
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
