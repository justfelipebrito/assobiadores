import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

function shouldUseEmulators() {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
}

const firebaseConfig = shouldUseEmulators()
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'demo-batalha.firebaseapp.com',
      projectId: 'demo-batalha',
      messagingSenderId: 'demo-sender',
      appId: 'demo-app',
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (shouldUseEmulators() && !authEmulatorConnected) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      authEmulatorConnected = true;
    }
  }
  return auth;
}

export function getClientFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    if (shouldUseEmulators() && !firestoreEmulatorConnected) {
      connectFirestoreEmulator(db, '127.0.0.1', 8085);
      firestoreEmulatorConnected = true;
    }
  }
  return db;
}
