import { FieldValue } from 'firebase-admin/firestore';

export interface AuthUserInput {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export function normalizeUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

export function getDefaultUsername(user: AuthUserInput) {
  const source = user.displayName || user.email?.split('@')[0] || `user_${user.uid.slice(0, 8)}`;
  const normalized = normalizeUsername(source);
  return normalized.length >= 3 ? normalized : `user_${user.uid.slice(0, 8)}`;
}

export function createDefaultUserData(user: AuthUserInput) {
  const username = getDefaultUsername(user);

  return {
    id: user.uid,
    schemaVersion: 1,
    username,
    usernameLower: username.toLowerCase(),
    displayName: user.displayName || 'Assobiador',
    email: user.email || '',
    photoURL: user.photoURL || null,
    bio: '',
    role: 'user',
    accountType: 'free',
    plan: 'free',
    state: null,
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
    rank: 'Iniciante',
    seasonPoints: {},
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
