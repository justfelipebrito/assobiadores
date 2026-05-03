import * as functionsV1 from 'firebase-functions/v1';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
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

  await db.runTransaction(async (transaction) => {
    transaction.set(userRef, userData);
    transaction.set(db.collection('usernames').doc(userData.usernameLower), {
      userId: user.uid,
      username: userData.usernameLower,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.collection('userPrivate').doc(user.uid), {
      id: user.uid,
      cpf: '',
      phone: '',
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
    });
  });
  functionsV1.logger.info(`User document created for ${user.uid}`);
});
