import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';
import {
  DEFAULT_SEASON_ID,
  buildInitialSeasonRanking,
  getSeasonRankingPath,
} from './season-ranking-service';

export interface BootstrapUserInput {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export function normalizeBootstrapUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

function getBaseUsername(user: BootstrapUserInput) {
  const source = user.displayName || user.email?.split('@')[0] || `user_${user.uid.slice(0, 8)}`;
  const normalized = normalizeBootstrapUsername(source);
  return normalized.length >= 3 ? normalized : `user_${user.uid.slice(0, 8)}`;
}

function getUsernameCandidates(user: BootstrapUserInput) {
  const base = getBaseUsername(user);
  return Array.from(
    new Set([
      base,
      `${base}_${user.uid.slice(0, 6).toLowerCase()}`,
      `user_${user.uid.slice(0, 8)}`,
    ]),
  );
}

function createPublicUserData(user: BootstrapUserInput, username: string) {
  return {
    id: user.uid,
    schemaVersion: 1,
    username,
    usernameLower: username.toLowerCase(),
    usernameChangeAvailableAt: null,
    firstName: '',
    surname: '',
    displayName: user.displayName || 'Assobiador',
    email: user.email || '',
    photoURL: user.photoURL || null,
    photoPath: null,
    photoVersion: 0,
    photoUpdatedAt: null,
    photoChangeAvailableAt: null,
    bio: '',
    role: 'user',
    accountType: 'free',
    plan: 'free',
    state: null,
    birthState: null,
    addressChangeAvailableAt: null,
    city: null,
    country: 'BR',
    officialProfile: {
      eligible: false,
      verified: false,
      state: null,
      region: null,
    },
    points: 0,
    xp: 0,
    casualPoints: 0,
    rank: 'Iniciante',
    seasonPoints: {},
    seasonCategoryPoints: {},
    stats: {
      battlesEntered: 0,
      battlesWon: 0,
      totalVotesReceived: 0,
      topThreeFinishes: 0,
    },
    badges: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function createPrivateUserData(userId: string) {
  return {
    id: userId,
    cpf: '',
    phone: '',
    pixKey: '',
    address: {
      postalCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: null,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function bootstrapUserProfile(db: Firestore, user: BootstrapUserInput) {
  if (!user.uid) throw new ApiError(400, 'Usuario invalido');

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(user.uid);
    const privateRef = db.collection('userPrivate').doc(user.uid);
    const existingUser = await transaction.get(userRef);
    const existingPrivate = await transaction.get(privateRef);

    if (existingUser.exists) {
      transaction.set(
        db.doc(getSeasonRankingPath(DEFAULT_SEASON_ID, user.uid)),
        buildInitialSeasonRanking({
          userId: user.uid,
          seasonId: DEFAULT_SEASON_ID,
          user: existingUser.data() ?? {},
        }),
        { merge: true },
      );
      if (!existingPrivate.exists) {
        transaction.set(privateRef, createPrivateUserData(user.uid), { merge: true });
      }
      return {
        created: false,
        username: existingUser.data()?.usernameLower ?? existingUser.data()?.username ?? null,
      };
    }

    let selectedUsername: string | null = null;
    for (const candidate of getUsernameCandidates(user)) {
      const usernameRef = db.collection('usernames').doc(candidate);
      const usernameDoc = await transaction.get(usernameRef);
      if (!usernameDoc.exists || usernameDoc.data()?.userId === user.uid) {
        selectedUsername = candidate;
        transaction.set(usernameRef, {
          userId: user.uid,
          username: candidate,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        break;
      }
    }

    if (!selectedUsername) {
      throw new ApiError(409, 'Nao foi possivel reservar um username inicial');
    }

    transaction.set(userRef, createPublicUserData(user, selectedUsername));
    transaction.set(privateRef, createPrivateUserData(user.uid), { merge: true });
    transaction.set(
      db.doc(getSeasonRankingPath(DEFAULT_SEASON_ID, user.uid)),
      buildInitialSeasonRanking({
        userId: user.uid,
        seasonId: DEFAULT_SEASON_ID,
        user: createPublicUserData(user, selectedUsername),
      }),
      { merge: true },
    );

    return { created: true, username: selectedUsername };
  });
}
