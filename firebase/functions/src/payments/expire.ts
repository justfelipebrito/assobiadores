import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

export const expirePayments = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    const expiredPayments = await db
      .collection('payments')
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();

    if (expiredPayments.empty) {
      return;
    }

    const batch = db.batch();
    let count = 0;

    for (const paymentDoc of expiredPayments.docs) {
      const paymentData = paymentDoc.data();

      // Mark payment as rejected
      batch.update(paymentDoc.ref, {
        status: 'rejected',
        updatedAt: now,
      });

      // Remove battle entry if still pending
      if (paymentData.entryId) {
        const entryRef = db.collection('battleEntries').doc(paymentData.entryId);
        const entryDoc = await entryRef.get();
        if (entryDoc.exists && entryDoc.data()?.status === 'pending_payment') {
          batch.delete(entryRef);
        }
      }

      count++;
    }

    await batch.commit();
    logger.info(`Expired ${count} pending payments`);
  },
);
