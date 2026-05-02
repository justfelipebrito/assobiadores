import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { expirePendingPayments } from './expire-handler';

export const expirePayments = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    await expirePendingPayments({
      db: getFirestore(),
      now: Timestamp.now(),
      logger,
    });
  },
);
