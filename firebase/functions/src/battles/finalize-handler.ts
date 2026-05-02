import { calculateRank, getPointsForPlace, getPrizeForPlace, POINTS_TABLE } from '../domain/ranking';

export interface FinalizeBattleFieldValue {
  increment(value: number): unknown;
  serverTimestamp(): unknown;
}

export interface FinalizeBattleLogger {
  info(message: string): void;
}

export interface FinalizeBattleFirestore {
  collection(name: string): {
    doc(id?: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, any> | undefined }>;
    };
    where(field: string, operator: string, value: unknown): any;
  };
  batch(): {
    update(ref: unknown, data: Record<string, unknown>): void;
    commit(): Promise<unknown>;
  };
}

export interface FinalizeBattleHttpsErrorFactory {
  new (code: any, message: string): Error;
}

export interface BattleWinnerResult {
  userId: string;
  place: number;
  points: number;
  prize: number;
}

export function shouldAwardOfficialBattlePoints(battle: Record<string, unknown>) {
  return battle.type === 'official';
}

export async function finalizeBattleHandler({
  db,
  battleId,
  fieldValue,
  logger,
  HttpsError,
}: {
  db: FinalizeBattleFirestore;
  battleId: string;
  fieldValue: FinalizeBattleFieldValue;
  logger: FinalizeBattleLogger;
  HttpsError: FinalizeBattleHttpsErrorFactory;
}) {
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

  const submissions = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('status', '==', 'approved')
    .orderBy('voteCount', 'desc')
    .get();

  if (submissions.empty) {
    throw new HttpsError('failed-precondition', 'Nenhuma submissao aprovada encontrada');
  }

  const entries = await db
    .collection('battleEntries')
    .where('battleId', '==', battleId)
    .where('status', '==', 'confirmed')
    .get();

  const awardsOfficialPoints = shouldAwardOfficialBattlePoints(battle);
  const batch = db.batch();
  const winners: BattleWinnerResult[] = [];

  const topSubmissions = submissions.docs.slice(0, 3);
  for (let i = 0; i < topSubmissions.length; i++) {
    const sub = topSubmissions[i]!;
    const place = i + 1;

    winners.push({
      userId: sub.data().userId,
      place,
      points: awardsOfficialPoints ? getPointsForPlace(place) : 0,
      prize: getPrizeForPlace(place, battle.prizeDistribution),
    });
  }

  if (awardsOfficialPoints) {
    const participantIds = new Set<string>();
    entries.docs.forEach((entry: { data(): Record<string, any> }) => {
      participantIds.add(entry.data().userId);
    });

    for (const userId of participantIds) {
      const userRef = db.collection('users').doc(userId);
      const winner = winners.find((w) => w.userId === userId);

      const pointsAwarded = winner ? winner.points : POINTS_TABLE.participation;
      const currentUser = await userRef.get();
      const currentPoints = currentUser.data()?.points || 0;
      const newRank = calculateRank(currentPoints + pointsAwarded);

      const statsUpdate: Record<string, unknown> = {
        'stats.battlesEntered': fieldValue.increment(1),
      };

      if (winner) {
        if (winner.place === 1) {
          statsUpdate['stats.battlesWon'] = fieldValue.increment(1);
        }
        if (winner.place <= 3) {
          statsUpdate['stats.topThreeFinishes'] = fieldValue.increment(1);
        }
      }

      batch.update(userRef, {
        points: fieldValue.increment(pointsAwarded),
        xp: fieldValue.increment(pointsAwarded),
        rank: newRank,
        ...statsUpdate,
        updatedAt: fieldValue.serverTimestamp(),
      });
    }
  }

  batch.update(battleRef, {
    status: 'finished',
    winners,
    officialScoringApplied: awardsOfficialPoints,
    updatedAt: fieldValue.serverTimestamp(),
  });

  await batch.commit();
  logger.info(
    `Battle ${battleId} finalized with ${winners.length} winners; official scoring: ${awardsOfficialPoints}`,
  );

  return { success: true, winners, officialScoringApplied: awardsOfficialPoints };
}
