import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { finalizeChampionshipHandler } from './finalize-championship-handler';

export const finalizeChampionship = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticacao necessaria');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem finalizar campeonatos');
    }

    const { championshipId } = request.data as { championshipId: string };
    if (!championshipId) {
      throw new HttpsError('invalid-argument', 'championshipId e obrigatorio');
    }

    try {
      const result = await finalizeChampionshipHandler(championshipId, {
        db,
        fieldValue: FieldValue,
        logger,
      });
      return { success: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao finalizar campeonato';
      if (message.includes('not found')) throw new HttpsError('not-found', message);
      if (message.includes('already finished')) throw new HttpsError('failed-precondition', message);
      if (message.includes('stage(s) still active')) throw new HttpsError('failed-precondition', message);
      throw new HttpsError('internal', message);
    }
  },
);
