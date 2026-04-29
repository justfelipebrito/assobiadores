import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const STATUS_TRANSITIONS: Array<{
  from: string;
  to: string;
  dateField: string;
}> = [
  { from: 'draft', to: 'registration', dateField: 'registrationStart' },
  { from: 'registration', to: 'active', dateField: 'registrationEnd' },
  { from: 'active', to: 'voting', dateField: 'submissionDeadline' },
];

export const scheduledBattleStatusUpdater = onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    let totalUpdated = 0;

    for (const transition of STATUS_TRANSITIONS) {
      const battles = await db
        .collection('battles')
        .where('status', '==', transition.from)
        .where(transition.dateField, '<=', now)
        .get();

      for (const battleDoc of battles.docs) {
        await battleDoc.ref.update({
          status: transition.to,
          updatedAt: now,
        });
        totalUpdated++;
        logger.info(
          `Battle ${battleDoc.id} transitioned from ${transition.from} to ${transition.to}`,
        );
      }
    }

    if (totalUpdated > 0) {
      logger.info(`Status updater: ${totalUpdated} battles transitioned`);
    }
  },
);
