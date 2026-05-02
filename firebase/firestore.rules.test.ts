import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'demo-batalha';

let testEnv: RulesTestEnvironment;

function authedDb(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8085,
      rules: readFileSync(join(process.cwd(), 'firebase/firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed('users/admin-1', {
    id: 'admin-1',
    schemaVersion: 1,
    username: 'admin',
    usernameLower: 'admin',
    displayName: 'Admin',
    role: 'admin',
    accountType: 'admin',
    plan: 'organization',
    state: 'SP',
    country: 'BR',
    officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' },
    points: 0,
  });
  await seed('users/user-1', {
    id: 'user-1',
    schemaVersion: 1,
    username: 'userone',
    usernameLower: 'userone',
    displayName: 'User One',
    role: 'user',
    accountType: 'free',
    plan: 'free',
    state: null,
    country: 'BR',
    officialProfile: { eligible: false, verified: false, state: null, region: null },
    points: 10,
    xp: 10,
    rank: 'Iniciante',
    stats: { battlesEntered: 0 },
    badges: [],
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('users rules', () => {
  it('allows public profile reads', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'users/user-1')));
  });

  it('allows users to create their own profile without protected fields', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb('new-user'), 'users/new-user'), {
        displayName: 'New User',
        email: 'new@example.com',
        bio: '',
      }),
    );
  });

  it('prevents users from creating server-owned profile fields', async () => {
    await assertFails(
      setDoc(doc(authedDb('new-user'), 'users/new-user'), {
        displayName: 'New User',
        username: 'officialname',
        usernameLower: 'officialname',
        role: 'admin',
        accountType: 'subscriber',
        plan: 'pro',
        officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' },
        points: 999999,
        seasonPoints: { '2026-s1': { points: 100, xp: 100, rank: 'Aprendiz' } },
      }),
    );
  });

  it('allows users to update editable profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb('user-1'), 'users/user-1'), {
        displayName: 'Updated',
        bio: 'Assobiador',
      }),
    );
  });

  it('prevents users from updating protected profile fields', async () => {
    for (const update of [
      { username: 'newname' },
      { usernameLower: 'newname' },
      { role: 'admin' },
      { accountType: 'subscriber' },
      { plan: 'pro' },
      { state: 'SP' },
      { country: 'US' },
      { officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' } },
      { points: 999999 },
      { seasonPoints: { '2026-s1': { points: 100, xp: 100, rank: 'Aprendiz' } } },
      { schemaVersion: 2 },
    ]) {
      await assertFails(updateDoc(doc(authedDb('user-1'), 'users/user-1'), update));
    }
  });

  it('prevents users from updating other profiles or deleting their own profile', async () => {
    await assertFails(
      updateDoc(doc(authedDb('user-2'), 'users/user-1'), {
        displayName: 'Hijacked',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('user-1'), 'users/user-1')));
  });
});

describe('battle rules', () => {
  beforeEach(async () => {
    await seed('battles/battle-1', {
      title: 'Batalha',
      status: 'registration',
      currentParticipants: 0,
    });
  });

  it('allows public reads', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'battles/battle-1')));
  });

  it('allows only admins to create or update battles', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'battles/user-created'), {
        title: 'Exploit',
      }),
    );
    await assertSucceeds(
      setDoc(doc(authedDb('admin-1'), 'battles/admin-created'), {
        title: 'Official',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(authedDb('admin-1'), 'battles/battle-1'), {
        status: 'active',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('admin-1'), 'battles/battle-1')));
  });
});

describe('payments rules', () => {
  beforeEach(async () => {
    await seed('payments/payment-1', {
      userId: 'user-1',
      status: 'pending',
      amount: 500,
    });
  });

  it('allows only the owner or an admin to read payments', async () => {
    await assertSucceeds(getDoc(doc(authedDb('user-1'), 'payments/payment-1')));
    await assertSucceeds(getDoc(doc(authedDb('admin-1'), 'payments/payment-1')));
    await assertFails(getDoc(doc(authedDb('user-2'), 'payments/payment-1')));
    await assertFails(getDoc(doc(unauthDb(), 'payments/payment-1')));
  });

  it('prevents all client payment writes', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'payments/payment-2'), {
        userId: 'user-1',
        status: 'approved',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'payments/payment-1'), {
        status: 'approved',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('admin-1'), 'payments/payment-1')));
  });
});

describe('seasons and championships rules', () => {
  beforeEach(async () => {
    await seed('seasons/2026-s1', {
      id: '2026-s1',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await seed('championships/champ-1', {
      id: 'champ-1',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  it('allows public reads for seasons and championships', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'seasons/2026-s1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'championships/champ-1')));
  });

  it('allows only admins to write seasons and championships', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb('admin-1'), 'seasons/2026-s1'), {
        status: 'archived',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(authedDb('admin-1'), 'championships/champ-1'), {
        status: 'finished',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'seasons/2026-s1'), {
        status: 'archived',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'championships/champ-1'), {
        status: 'finished',
      }),
    );
  });
});

describe('battleInvites rules', () => {
  beforeEach(async () => {
    await seed('battleInvites/invite-1', {
      battleId: 'battle-1',
      fromUserId: 'user-1',
      toUserId: 'user-2',
      status: 'pending',
    });
  });

  it('allows the recipient to read their invite', async () => {
    await assertSucceeds(getDoc(doc(authedDb('user-2'), 'battleInvites/invite-1')));
  });

  it('allows the sender to read their invite', async () => {
    await assertSucceeds(getDoc(doc(authedDb('user-1'), 'battleInvites/invite-1')));
  });

  it('prevents third parties from reading invites', async () => {
    await assertFails(getDoc(doc(authedDb('user-3'), 'battleInvites/invite-1')));
    await assertFails(getDoc(doc(unauthDb(), 'battleInvites/invite-1')));
  });

  it('prevents any client from writing invites', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'battleInvites/invite-2'), {
        battleId: 'battle-1',
        fromUserId: 'user-1',
        toUserId: 'user-3',
        status: 'pending',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-2'), 'battleInvites/invite-1'), {
        status: 'accepted',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('user-1'), 'battleInvites/invite-1')));
  });
});

describe('server-owned collections rules', () => {
  beforeEach(async () => {
    await seed('battleEntries/entry-1', {
      userId: 'user-1',
      battleId: 'battle-1',
      status: 'confirmed',
    });
    await seed('submissions/submission-1', {
      userId: 'user-1',
      battleId: 'battle-1',
      status: 'approved',
    });
    await seed('votes/vote-1', {
      voterId: 'user-1',
      battleId: 'battle-1',
      submissionId: 'submission-1',
    });
  });

  it('allows public reads for entries, submissions, and votes', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'battleEntries/entry-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'submissions/submission-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'votes/vote-1')));
  });

  it('prevents direct client writes to battle entries', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'battleEntries/entry-2'), {
        userId: 'user-1',
        battleId: 'battle-1',
        status: 'confirmed',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'battleEntries/entry-1'), {
        status: 'disqualified',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('user-1'), 'battleEntries/entry-1')));
  });

  it('prevents direct client writes to submissions and votes', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'submissions/submission-2'), {
        userId: 'user-1',
        battleId: 'battle-1',
        status: 'draft',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'submissions/submission-1'), {
        status: 'approved',
      }),
    );
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'votes/vote-2'), {
        voterId: 'user-1',
        battleId: 'battle-1',
        submissionId: 'submission-1',
      }),
    );
  });
});
