import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'demo-batalha-rules-test';

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
    firstName: 'Admin',
    surname: 'Local',
    displayName: 'Admin',
    role: 'admin',
    accountType: 'admin',
    plan: 'organization',
    state: 'SP',
    birthState: 'SP',
    country: 'BR',
    officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' },
    points: 0,
  });
  await seed('users/user-1', {
    id: 'user-1',
    schemaVersion: 1,
    username: 'userone',
    usernameLower: 'userone',
    firstName: 'User',
    surname: 'One',
    displayName: 'User One',
    role: 'user',
    accountType: 'free',
    plan: 'free',
    state: null,
    birthState: null,
    country: 'BR',
    officialProfile: { eligible: false, verified: false, state: null, region: null },
    points: 10,
    xp: 10,
    casualPoints: 0,
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
        usernameChangeAvailableAt: serverTimestamp(),
        role: 'admin',
        accountType: 'subscriber',
        plan: 'pro',
        officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' },
        addressChangeAvailableAt: serverTimestamp(),
        photoURL: 'https://example.com/avatar.png',
        photoPath: 'users/new-user/profile/avatar.jpg',
        photoVersion: 1,
        photoUpdatedAt: serverTimestamp(),
        photoChangeAvailableAt: serverTimestamp(),
        points: 999999,
        casualPoints: 999999,
        seasonPoints: { '2026': { points: 100, xp: 100, rank: 'Aprendiz' } },
        seasonCategoryPoints: {
          '2026': { freestyle: { points: 100, xp: 100, rank: 'Aprendiz' } },
        },
      }),
    );
  });

  it('allows users to update editable profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb('user-1'), 'users/user-1'), {
        displayName: 'Updated',
        bio: 'Assobiador',
        firstName: 'User',
        surname: 'Updated',
      }),
    );
  });

  it('prevents users from updating protected profile fields', async () => {
    for (const update of [
      { username: 'newname' },
      { usernameLower: 'newname' },
      { usernameChangeAvailableAt: serverTimestamp() },
      { role: 'admin' },
      { accountType: 'subscriber' },
      { plan: 'pro' },
      { state: 'SP' },
      { birthState: 'RJ' },
      { country: 'US' },
      { addressChangeAvailableAt: serverTimestamp() },
      { officialProfile: { eligible: true, verified: true, state: 'SP', region: 'Sudeste' } },
      { photoURL: 'https://example.com/avatar.png' },
      { photoPath: 'users/user-1/profile/avatar.jpg' },
      { photoVersion: 2 },
      { photoUpdatedAt: serverTimestamp() },
      { photoChangeAvailableAt: serverTimestamp() },
      { points: 999999 },
      { casualPoints: 999999 },
      { seasonPoints: { '2026': { points: 100, xp: 100, rank: 'Aprendiz' } } },
      {
        seasonCategoryPoints: {
          '2026': { freestyle: { points: 100, xp: 100, rank: 'Aprendiz' } },
        },
      },
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

  it('allows only owners to read private profile data and blocks client writes', async () => {
    await seed('userPrivate/user-1', {
      id: 'user-1',
      cpf: '12345678909',
      phone: '11999999999',
      address: { city: 'Sao Paulo', state: 'SP' },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await assertSucceeds(getDoc(doc(authedDb('user-1'), 'userPrivate/user-1')));
    await assertFails(getDoc(doc(authedDb('user-2'), 'userPrivate/user-1')));
    await assertFails(getDoc(doc(unauthDb(), 'userPrivate/user-1')));
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'userPrivate/user-1'), {
        cpf: '00000000000',
      }),
    );
  });

  it('allows username availability reads but blocks client reservation writes', async () => {
    await seed('usernames/userone', {
      userId: 'user-1',
      username: 'userone',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await assertSucceeds(getDoc(doc(unauthDb(), 'usernames/userone')));
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'usernames/newuser'), {
        userId: 'user-1',
        username: 'newuser',
      }),
    );
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
    await seed('seasons/2026', {
      id: '2026',
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
    await assertSucceeds(getDoc(doc(unauthDb(), 'seasons/2026')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'championships/champ-1')));
  });

  it('allows only admins to write seasons and championships', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb('admin-1'), 'seasons/2026'), {
        status: 'archived',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(authedDb('admin-1'), 'championships/champ-1'), {
        status: 'finished',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'seasons/2026'), {
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
    await seed('dailyHighlights/daily-1', {
      userId: 'user-1',
      dayKey: '2026-05-03',
      status: 'active',
      voteCount: 0,
    });
    await seed('dailyHighlightLikes/like-1', {
      dayKey: '2026-05-03',
      dailyHighlightId: 'daily-1',
      userId: 'user-2',
    });
    await seed('qualifierRegistrations/qualifier-registration-1', {
      userId: 'user-1',
      seasonId: '2026',
      category: 'freestyle',
      region: 'SP',
      status: 'confirmed',
    });
    await seed('qualifierMatches/qualifier-match-1', {
      seasonId: '2026',
      category: 'freestyle',
      region: 'SP',
      roundNumber: 1,
      participantIds: ['user-1', 'user-2'],
      registrationIds: ['qualifier-registration-1', 'qualifier-registration-2'],
      status: 'scheduled',
    });
    await seed('qualifierSubmissions/qualifier-submission-1', {
      matchId: 'qualifier-match-1',
      registrationId: 'qualifier-registration-1',
      userId: 'user-1',
      mediaType: 'audio',
      mediaURL: 'https://storage.example/audio.webm',
      status: 'submitted',
    });
    await seed('qualifierVotes/qualifier-vote-1', {
      matchId: 'qualifier-match-1',
      submissionId: 'qualifier-submission-1',
      votedUserId: 'user-1',
      voterId: 'user-2',
      voterType: 'public',
      weight: 1,
    });
    await seed('submissionReports/report-1', {
      submissionId: 'submission-1',
      battleId: 'battle-1',
      reporterId: 'user-2',
      reportedUserId: 'user-1',
      reason: 'platform_rules',
      status: 'open',
    });
    await seed('qualifierTracks/qualifier-sp-2026-freestyle', {
      seasonId: 'season-2026',
      seasonYear: 2026,
      category: 'freestyle',
      region: 'SP',
      status: 'registration_open',
      confirmedCount: 12,
      maxQualified: 64,
    });
    await seed('qualifierParticipants/qualifier-registration-1', {
      userId: 'user-1',
      seasonId: 'season-2026',
      seasonYear: 2026,
      category: 'freestyle',
      region: 'SP',
      displayName: 'User One',
      rank: 'Iniciante',
      points: 25,
    });
  });

  it('allows public reads for entries, submissions, votes, daily highlights, and qualifier fixtures', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'battleEntries/entry-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'submissions/submission-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'votes/vote-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'dailyHighlights/daily-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'dailyHighlightLikes/like-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'qualifierMatches/qualifier-match-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'qualifierSubmissions/qualifier-submission-1')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'qualifierTracks/qualifier-sp-2026-freestyle')));
    await assertSucceeds(getDoc(doc(unauthDb(), 'qualifierParticipants/qualifier-registration-1')));
  });

  it('allows only the voter or admin to read qualifier votes', async () => {
    await assertSucceeds(getDoc(doc(authedDb('user-2'), 'qualifierVotes/qualifier-vote-1')));
    await assertSucceeds(getDoc(doc(authedDb('admin-1'), 'qualifierVotes/qualifier-vote-1')));
    await assertFails(getDoc(doc(authedDb('user-1'), 'qualifierVotes/qualifier-vote-1')));
    await assertFails(getDoc(doc(unauthDb(), 'qualifierVotes/qualifier-vote-1')));
  });

  it('allows only the reporter or admin to read submission reports', async () => {
    await assertSucceeds(getDoc(doc(authedDb('user-2'), 'submissionReports/report-1')));
    await assertSucceeds(getDoc(doc(authedDb('admin-1'), 'submissionReports/report-1')));
    await assertFails(getDoc(doc(authedDb('user-1'), 'submissionReports/report-1')));
    await assertFails(getDoc(doc(unauthDb(), 'submissionReports/report-1')));
  });

  it('allows users to read only their own qualifier registrations', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb('user-1'), 'qualifierRegistrations/qualifier-registration-1')),
    );
    await assertFails(
      getDoc(doc(authedDb('user-2'), 'qualifierRegistrations/qualifier-registration-1')),
    );
    await assertFails(getDoc(doc(unauthDb(), 'qualifierRegistrations/qualifier-registration-1')));

    await assertSucceeds(
      getDocs(
        query(
          collection(authedDb('user-1'), 'qualifierRegistrations'),
          where('userId', '==', 'user-1'),
        ),
      ),
    );
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
    await assertFails(
      setDoc(doc(authedDb('user-2'), 'submissionReports/report-2'), {
        submissionId: 'submission-1',
        reporterId: 'user-2',
        reason: 'platform_rules',
      }),
    );
  });

  it('prevents direct client writes to daily highlights and likes', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'dailyHighlights/daily-2'), {
        userId: 'user-1',
        status: 'active',
        voteCount: 0,
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'dailyHighlights/daily-1'), {
        voteCount: 999,
      }),
    );
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'dailyHighlightLikes/like-2'), {
        dailyHighlightId: 'daily-1',
        userId: 'user-1',
      }),
    );
  });

  it('prevents direct client writes to qualifier registrations', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'qualifierRegistrations/qualifier-registration-2'), {
        userId: 'user-1',
        seasonId: '2026',
        status: 'pending_payment',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'qualifierRegistrations/qualifier-registration-1'), {
        status: 'confirmed',
      }),
    );
    await assertFails(
      deleteDoc(doc(authedDb('user-1'), 'qualifierRegistrations/qualifier-registration-1')),
    );
  });

  it('prevents direct client writes to qualifier matches', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'qualifierMatches/qualifier-match-2'), {
        seasonId: '2026',
        status: 'scheduled',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'qualifierMatches/qualifier-match-1'), {
        status: 'finished',
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('user-1'), 'qualifierMatches/qualifier-match-1')));
  });

  it('prevents direct client writes to qualifier submissions', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'qualifierSubmissions/qualifier-submission-2'), {
        matchId: 'qualifier-match-1',
        userId: 'user-1',
        mediaType: 'audio',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'qualifierSubmissions/qualifier-submission-1'), {
        status: 'disqualified',
      }),
    );
    await assertFails(
      deleteDoc(doc(authedDb('user-1'), 'qualifierSubmissions/qualifier-submission-1')),
    );
  });

  it('prevents direct client writes to qualifier votes', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-2'), 'qualifierVotes/qualifier-vote-2'), {
        matchId: 'qualifier-match-1',
        voterId: 'user-2',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-2'), 'qualifierVotes/qualifier-vote-1'), {
        weight: 99,
      }),
    );
    await assertFails(deleteDoc(doc(authedDb('user-2'), 'qualifierVotes/qualifier-vote-1')));
  });

  it('prevents direct client writes to qualifier tracks', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'qualifierTracks/qualifier-rj-2026-freestyle'), {
        seasonId: 'season-2026',
        status: 'registration_open',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'qualifierTracks/qualifier-sp-2026-freestyle'), {
        confirmedCount: 99,
      }),
    );
    await assertFails(
      deleteDoc(doc(authedDb('user-1'), 'qualifierTracks/qualifier-sp-2026-freestyle')),
    );
  });

  it('prevents direct client writes to qualifier participants', async () => {
    await assertFails(
      setDoc(doc(authedDb('user-1'), 'qualifierParticipants/qualifier-registration-2'), {
        userId: 'user-1',
        seasonId: 'season-2026',
      }),
    );
    await assertFails(
      updateDoc(doc(authedDb('user-1'), 'qualifierParticipants/qualifier-registration-1'), {
        points: 999,
      }),
    );
    await assertFails(
      deleteDoc(doc(authedDb('user-1'), 'qualifierParticipants/qualifier-registration-1')),
    );
  });
});
