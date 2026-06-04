import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { finalizeBattleHandler } from './finalize-handler';

const MAX_BATTLES_PER_PHASE_PER_RUN = 100;

const STATUS_TRANSITIONS: Array<{
  from: string;
  to: string;
  dateField: string;
}> = [
  { from: 'draft', to: 'registration', dateField: 'registrationStart' },
  { from: 'registration', to: 'active', dateField: 'registrationEnd' },
  { from: 'active', to: 'voting', dateField: 'votingStart' },
];

class ScheduledBattleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function transitionDueBattles({
  db,
  now,
}: {
  db: Firestore;
  now: Timestamp;
}) {
  let transitionedCount = 0;

  for (const transition of STATUS_TRANSITIONS) {
    const battles = await db
      .collection('battles')
      .where('status', '==', transition.from)
      .where(transition.dateField, '<=', now)
      .limit(MAX_BATTLES_PER_PHASE_PER_RUN)
      .get();

    if (battles.empty) continue;

    const batch = db.batch();
    for (const battleDoc of battles.docs) {
      batch.update(battleDoc.ref, {
        status: transition.to,
        [`statusChangedAt.${transition.to}`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transitionedCount++;
      logger.info(
        `Battle ${battleDoc.id} transitioned from ${transition.from} to ${transition.to}`,
      );
    }
    await batch.commit();
  }

  return transitionedCount;
}

async function finalizeDueBattles({
  db,
  now,
}: {
  db: Firestore;
  now: Timestamp;
}) {
  const battles = await db
    .collection('battles')
    .where('status', '==', 'voting')
    .where('votingEnd', '<=', now)
    .limit(MAX_BATTLES_PER_PHASE_PER_RUN)
    .get();

  let finalizedCount = 0;
  let failedCount = 0;

  for (const battleDoc of battles.docs) {
    try {
      await finalizeBattleHandler({
        db,
        battleId: battleDoc.id,
        fieldValue: FieldValue,
        logger,
        HttpsError: ScheduledBattleError,
      });
      finalizedCount++;
      logger.info(`Battle ${battleDoc.id} finalized by scheduled lifecycle watcher`);
    } catch (error) {
      failedCount++;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Battle ${battleDoc.id} scheduled finalization failed: ${message}`);
    }
  }

  return { checkedCount: battles.size, finalizedCount, failedCount };
}

export async function runBattleLifecycleWatcher(
  db: Firestore,
  { now = Timestamp.now() }: { now?: Timestamp } = {},
) {
  const transitionedCount = await transitionDueBattles({ db, now });
  const finalization = await finalizeDueBattles({ db, now });

  if (transitionedCount > 0 || finalization.checkedCount > 0) {
    logger.info(
      `Battle lifecycle watcher: ${transitionedCount} transitioned, ${finalization.finalizedCount}/${finalization.checkedCount} finalized, ${finalization.failedCount} failed`,
    );
  }

  return { transitionedCount, ...finalization };
}

export const scheduledBattleStatusUpdater = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    await runBattleLifecycleWatcher(getFirestore());
  },
);
