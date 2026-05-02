import type { Firestore, Timestamp } from 'firebase-admin/firestore';

export interface ExpirePaymentsLogger {
  info(message: string): void;
}

export async function expirePendingPayments({
  db,
  now,
  logger,
}: {
  db: Firestore;
  now: Timestamp;
  logger: ExpirePaymentsLogger;
}) {
  const expiredPayments = await db
    .collection('payments')
    .where('status', '==', 'pending')
    .where('expiresAt', '<=', now)
    .get();

  if (expiredPayments.empty) {
    return { expiredCount: 0 };
  }

  const batch = db.batch();
  let count = 0;

  for (const paymentDoc of expiredPayments.docs) {
    const paymentData = paymentDoc.data();

    batch.update(paymentDoc.ref, {
      status: 'rejected',
      updatedAt: now,
    });

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

  return { expiredCount: count };
}
