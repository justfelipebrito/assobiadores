import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const POINTS_TABLE = { first: 100, second: 70, third: 50, participation: 10 };

function getPointsForPlace(place: number): number {
  switch (place) {
    case 1:
      return POINTS_TABLE.first;
    case 2:
      return POINTS_TABLE.second;
    case 3:
      return POINTS_TABLE.third;
    default:
      return POINTS_TABLE.participation;
  }
}

const RANKS = [
  { minPoints: 0, name: 'Iniciante' },
  { minPoints: 50, name: 'Aprendiz' },
  { minPoints: 150, name: 'Assobiador' },
  { minPoints: 400, name: 'Assobiador Experiente' },
  { minPoints: 800, name: 'Mestre Assobiador' },
  { minPoints: 1500, name: 'Grão-Mestre' },
  { minPoints: 3000, name: 'Lenda do Assobio' },
];

function calculateRank(points: number): string {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i]!.minPoints) {
      return RANKS[i]!.name;
    }
  }
  return RANKS[0]!.name;
}

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

    const { battleId } = request.data;
    if (!battleId) {
      throw new HttpsError('invalid-argument', 'battleId e obrigatorio');
    }

    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await battleRef.get();

    if (!battleDoc.exists) {
      throw new HttpsError('not-found', 'Batalha nao encontrada');
    }

    const battle = battleDoc.data()!;
    if (battle.status !== 'voting') {
      throw new HttpsError('failed-precondition', 'Batalha precisa estar em votacao para ser finalizada');
    }

    // Get all approved submissions sorted by votes
    const submissions = await db
      .collection('submissions')
      .where('battleId', '==', battleId)
      .where('status', '==', 'approved')
      .orderBy('voteCount', 'desc')
      .get();

    if (submissions.empty) {
      throw new HttpsError('failed-precondition', 'Nenhuma submissao aprovada encontrada');
    }

    // Get all confirmed entries for participation points
    const entries = await db
      .collection('battleEntries')
      .where('battleId', '==', battleId)
      .where('status', '==', 'confirmed')
      .get();

    const batch = db.batch();
    const winners: Array<{ userId: string; place: number; points: number; prize: number }> = [];

    // Determine winners (top 3)
    const topSubmissions = submissions.docs.slice(0, 3);
    for (let i = 0; i < topSubmissions.length; i++) {
      const sub = topSubmissions[i]!;
      const place = i + 1;
      const points = getPointsForPlace(place);
      const prize =
        battle.prizeDistribution
          ? (place === 1
              ? battle.prizeDistribution.first
              : place === 2
                ? battle.prizeDistribution.second
                : battle.prizeDistribution.third)
          : 0;

      winners.push({
        userId: sub.data().userId,
        place,
        points,
        prize,
      });
    }

    // Collect all participant userIds
    const participantIds = new Set<string>();
    entries.docs.forEach((entry) => {
      participantIds.add(entry.data().userId);
    });

    // Award points to all participants
    for (const userId of participantIds) {
      const userRef = db.collection('users').doc(userId);
      const winner = winners.find((w) => w.userId === userId);

      const pointsAwarded = winner ? winner.points : POINTS_TABLE.participation;
      const xpAwarded = pointsAwarded; // XP matches points for now

      // Get current user data to calculate new rank
      const currentUser = await userRef.get();
      const currentPoints = currentUser.data()?.points || 0;
      const newPoints = currentPoints + pointsAwarded;
      const newRank = calculateRank(newPoints);

      const statsUpdate: Record<string, unknown> = {
        'stats.battlesEntered': FieldValue.increment(1),
      };

      if (winner) {
        if (winner.place === 1) {
          statsUpdate['stats.battlesWon'] = FieldValue.increment(1);
        }
        if (winner.place <= 3) {
          statsUpdate['stats.topThreeFinishes'] = FieldValue.increment(1);
        }
      }

      batch.update(userRef, {
        points: FieldValue.increment(pointsAwarded),
        xp: FieldValue.increment(xpAwarded),
        rank: newRank,
        ...statsUpdate,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Update battle
    batch.update(battleRef, {
      status: 'finished',
      winners,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    logger.info(`Battle ${battleId} finalized with ${winners.length} winners`);

    return { success: true, winners };
  },
);
