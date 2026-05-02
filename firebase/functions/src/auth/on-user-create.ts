import * as functionsV1 from 'firebase-functions/v1';
import { getFirestore } from 'firebase-admin/firestore';
import { createDefaultUserData } from './user-defaults';

export const onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const db = getFirestore();
  const userRef = db.collection('users').doc(user.uid);
  const existingUser = await userRef.get();

  if (existingUser.exists) {
    functionsV1.logger.info(`User document already exists for ${user.uid}`);
    return;
  }

  const userData = createDefaultUserData(user);

  await userRef.set(userData);
  functionsV1.logger.info(`User document created for ${user.uid}`);
});
