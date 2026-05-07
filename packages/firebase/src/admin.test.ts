import { describe, expect, it } from 'vitest';

import { buildAdminAppOptions } from './admin';

describe('buildAdminAppOptions', () => {
  it('uses App Hosting default credentials when explicit admin credentials are absent', () => {
    const options = buildAdminAppOptions({
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'assobiadores-3f0f6',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'assobiadores-3f0f6.firebasestorage.app',
    });

    expect(options).toEqual({
      storageBucket: 'assobiadores-3f0f6.firebasestorage.app',
    });
  });

  it('keeps emulator initialization project-scoped without requiring private keys', () => {
    const options = buildAdminAppOptions({
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      GCLOUD_PROJECT: 'demo-batalha',
    });

    expect(options).toEqual({
      projectId: 'demo-batalha',
      storageBucket: 'demo-batalha.appspot.com',
    });
  });

  it('rejects partially configured explicit admin credentials', () => {
    expect(() =>
      buildAdminAppOptions({
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'assobiadores-3f0f6',
        FIREBASE_ADMIN_CLIENT_EMAIL: 'firebase-admin@example.com',
      }),
    ).toThrow('FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY must be set together.');
  });
});
