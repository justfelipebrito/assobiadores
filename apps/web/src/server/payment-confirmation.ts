import { FieldValue, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export async function confirmPaymentTargets(db: Firestore, paymentDoc: DocumentSnapshot) {
  const payment = paymentDoc.data();
  if (!payment) {
    throw new ApiError(404, 'Pagamento nao encontrado');
  }

  if (payment.status === 'approved') {
    return;
  }

  const batch = db.batch();
  batch.update(paymentDoc.ref, {
    status: 'approved',
    webhookReceivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (payment.entryId) {
    batch.update(db.collection('battleEntries').doc(payment.entryId), {
      status: 'confirmed',
    });
  }

  if (payment.qualifierRegistrationId) {
    const registrationRef = db
      .collection('qualifierRegistrations')
      .doc(payment.qualifierRegistrationId);
    const registrationDoc = await registrationRef.get();
    const registration = registrationDoc.data();
    const participantUserDoc = registration?.userId
      ? await db.collection('users').doc(registration.userId).get()
      : null;
    const participantUser = participantUserDoc?.data();
    batch.update(registrationRef, {
      status: 'confirmed',
      bracketStatus: 'waiting_draw',
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (registration?.region && registration?.category) {
      const seasonYear = Number(
        String(registration.seasonId ?? 'season-2026').match(/\d{4}/)?.[0] ?? 2026,
      );
      const category = String(registration.category);
      const seasonKey = String(seasonYear);
      const categoryPoints = participantUser?.seasonCategoryPoints?.[seasonKey]?.[category];

      batch.set(
        db
          .collection('qualifierTracks')
          .doc(
            `qualifier-${String(registration.region).toLowerCase()}-2026-${registration.category}`,
          ),
        {
          confirmedCount: FieldValue.increment(1),
          pendingPaymentCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batch.set(
        db.collection('qualifierParticipants').doc(registrationRef.id),
        {
          userId: registration.userId,
          seasonId: registration.seasonId ?? 'season-2026',
          seasonYear,
          category: registration.category,
          region: registration.region,
          displayName:
            typeof participantUser?.displayName === 'string' && participantUser.displayName.trim()
              ? participantUser.displayName
              : 'Participante',
          rank: categoryPoints?.rank ?? 'Iniciante',
          points: categoryPoints?.points ?? 0,
          confirmedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  if (payment.battleId) {
    batch.update(db.collection('battles').doc(payment.battleId), {
      currentParticipants: FieldValue.increment(1),
    });
  }

  await batch.commit();
}
