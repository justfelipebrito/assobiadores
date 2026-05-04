import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface MercadoPagoPaymentClient {
  get(input: { id: number }): Promise<{
    external_reference?: string | null;
    status?: string | null;
  } | null>;
}

export interface PaymentWebhookLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface PaymentWebhookBody {
  action?: string;
  data?: {
    id?: string | number;
  };
}

async function findPaymentByExternalIdentifier({
  db,
  externalPaymentId,
}: {
  db: Firestore;
  externalPaymentId: string;
}) {
  const paymentIdQuery = await db
    .collection('payments')
    .where('externalPaymentId', '==', externalPaymentId)
    .limit(1)
    .get();

  if (!paymentIdQuery.empty) {
    return paymentIdQuery.docs[0];
  }

  const legacyPaymentQuery = await db
    .collection('payments')
    .where('externalId', '==', externalPaymentId)
    .limit(1)
    .get();

  return legacyPaymentQuery.docs[0] ?? null;
}

export async function processPaymentWebhook({
  body,
  db,
  mpPayment,
  logger,
}: {
  body: PaymentWebhookBody;
  db: Firestore;
  mpPayment: MercadoPagoPaymentClient;
  logger: PaymentWebhookLogger;
}) {
  const { action, data } = body;

  if (!action || !action.startsWith('payment.')) {
    return { processed: false, reason: 'ignored_event' };
  }

  const paymentId = data?.id;
  if (!paymentId) {
    logger.warn('Webhook received without payment ID');
    return { processed: false, reason: 'missing_payment_id' };
  }

  logger.info(`Processing webhook for payment ${paymentId}, action: ${action}`);

  const mpData = await mpPayment.get({ id: Number(paymentId) });
  if (!mpData) {
    logger.warn(`Payment ${paymentId} not found in Mercado Pago`);
    return { processed: false, reason: 'mercado_pago_payment_not_found' };
  }

  const externalPaymentId = String(paymentId);
  const paymentDoc = await findPaymentByExternalIdentifier({ db, externalPaymentId });

  if (!paymentDoc) {
    logger.warn(`No payment document found for externalPaymentId ${externalPaymentId}`);
    return { processed: false, reason: 'payment_not_found' };
  }

  const paymentData = paymentDoc.data();

  if (paymentData.webhookReceivedAt) {
    logger.info(`Payment ${externalPaymentId} already processed, skipping`);
    return { processed: false, reason: 'already_processed' };
  }

  const batch = db.batch();
  const mpStatus = mpData.status;

  if (mpStatus === 'approved') {
    batch.update(paymentDoc.ref, {
      status: 'approved',
      webhookReceivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paymentData.entryId) {
      const entryRef = db.collection('battleEntries').doc(paymentData.entryId);
      batch.update(entryRef, { status: 'confirmed' });
    }

    if (paymentData.qualifierRegistrationId) {
      const registrationRef = db
        .collection('qualifierRegistrations')
        .doc(paymentData.qualifierRegistrationId);
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

    if (paymentData.battleId) {
      const battleRef = db.collection('battles').doc(paymentData.battleId);
      batch.update(battleRef, {
        currentParticipants: FieldValue.increment(1),
      });
    }

    await batch.commit();
    logger.info(`Payment ${externalPaymentId} approved and entry confirmed`);
    return { processed: true, status: 'approved' };
  }

  if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    batch.update(paymentDoc.ref, {
      status: 'rejected',
      webhookReceivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paymentData.qualifierRegistrationId) {
      const registrationRef = db
        .collection('qualifierRegistrations')
        .doc(paymentData.qualifierRegistrationId);
      const registrationDoc = await registrationRef.get();
      const registration = registrationDoc.data();
      batch.update(registrationRef, {
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (registration?.region && registration?.category) {
        batch.set(
          db
            .collection('qualifierTracks')
            .doc(
              `qualifier-${String(registration.region).toLowerCase()}-2026-${registration.category}`,
            ),
          {
            pendingPaymentCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    await batch.commit();
    logger.info(`Payment ${externalPaymentId} rejected/cancelled`);
    return { processed: true, status: 'rejected' };
  }

  logger.info(`Payment ${externalPaymentId} status ${mpStatus ?? 'unknown'} ignored`);
  return { processed: false, reason: 'ignored_status' };
}
