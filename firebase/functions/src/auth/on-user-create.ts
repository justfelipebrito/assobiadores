import * as functionsV1 from 'firebase-functions/v1';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const db = getFirestore();

  const userData = {
    id: user.uid,
    displayName: user.displayName || 'Assobiador',
    email: user.email || '',
    photoURL: user.photoURL || null,
    bio: '',
    role: 'user',
    points: 0,
    xp: 0,
    rank: 'Iniciante',
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

  await db.collection('users').doc(user.uid).set(userData);
  functionsV1.logger.info(`User document created for ${user.uid}`);
});
