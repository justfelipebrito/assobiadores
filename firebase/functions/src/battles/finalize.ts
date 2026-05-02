import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { finalizeBattleHandler } from './finalize-handler';

export const finalizeBattle = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    // Verify admin
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticacao necessaria');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem finalizar batalhas');
    }

    return finalizeBattleHandler({
      db,
      battleId: request.data?.battleId,
      fieldValue: FieldValue,
      logger,
      HttpsError,
    });
  },
);
