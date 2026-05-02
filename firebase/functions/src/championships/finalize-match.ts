import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { finalizeMatchHandler } from './finalize-match-handler';

export const finalizeMatch = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticacao necessaria');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem finalizar partidas');
    }

    const { championshipId, stageId, matchId } = request.data as {
      championshipId: string;
      stageId: string;
      matchId: string;
    };

    if (!championshipId || !stageId || !matchId) {
      throw new HttpsError('invalid-argument', 'championshipId, stageId e matchId sao obrigatorios');
    }

    try {
      const result = await finalizeMatchHandler(
        { championshipId, stageId, matchId },
        { db, fieldValue: FieldValue, logger },
      );
      return { success: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao finalizar partida';
      if (message.includes('not found')) throw new HttpsError('not-found', message);
      if (message.includes('voting')) throw new HttpsError('failed-precondition', message);
      throw new HttpsError('internal', message);
    }
  },
);
