import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { POINTS_TABLE } from '../domain/ranking';
import { buildSeasonRankingIncrement, getSeasonRankingPath } from '../domain/season-ranking';

export interface MercadoPagoPaymentClient {
  get(input: { id: number }): Promise<{
    external_reference?: string | null;
    status?: string | null;
  } | null>;
}

export interface MercadoPagoOrderClient {
  get(input: { id: string }): Promise<{
    status?: string | null;
    status_detail?: string | null;
    transactions?: {
      payments?: Array<{
        id?: string | null;
        status?: string | null;
        status_detail?: string | null;
      }>;
    };
  } | null>;
}

export interface PaymentWebhookLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface PaymentWebhookBody {
  action?: string;
  type?: string;
  data?: {
    id?: string | number;
  };
}

function cleanIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildPointActivityId({
  userId,
  reason,
  sourceType,
  sourceId,
}: {
  userId: string;
  reason: string;
  sourceType: string;
  sourceId: string;
}) {
  return [sourceType, sourceId, reason, userId].map((part) => cleanIdPart(part)).join('__');
}

function buildQualifierEntryPointActivity({
  userId,
  registrationId,
  region,
  category,
  seasonId,
}: {
  userId: string;
  registrationId: string;
  region: string;
  category: string;
  seasonId: string;
}) {
  const id = buildPointActivityId({
    userId,
    reason: 'qualifier_entry',
    sourceType: 'qualifier',
    sourceId: registrationId,
  });

  return {
    id,
    userId,
    points: POINTS_TABLE.qualifierEntry,
    reason: 'qualifier_entry',
    label: 'Entrada em Classificatoria',
    sourceType: 'qualifier',
    sourceId: registrationId,
    sourceTitle: `Classificatoria ${region} ${category}`,
    category,
    seasonId,
    occurredAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };
}

function buildQualifierEntryPointsUpdate(category: string, seasonId: string) {
  const points = POINTS_TABLE.qualifierEntry;

  return {
    points: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.points`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.xp`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.updatedAt`]: FieldValue.serverTimestamp(),
    [`seasonCategoryPoints.${seasonId}.${category}.points`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.xp`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function getBattlePrizeShares(amount: number) {
  const prizePool = Math.floor(amount * 0.8);
  const first = Math.floor(prizePool * 0.5);
  const second = Math.floor(prizePool * 0.3);
  const third = prizePool - first - second;

  return { prizePool, first, second, third };
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

function getOrdersApiStatus(order: NonNullable<Awaited<ReturnType<MercadoPagoOrderClient['get']>>>) {
  const payment = order.transactions?.payments?.[0];
  const statuses = [
    order.status,
    order.status_detail,
    payment?.status,
    payment?.status_detail,
  ].filter((status): status is string => typeof status === 'string');

  if (statuses.some((status) => ['processed', 'approved', 'accredited'].includes(status))) {
    return 'approved';
  }

  if (
    statuses.some((status) =>
      ['rejected', 'cancelled', 'canceled', 'expired', 'failed'].includes(status),
    )
  ) {
    return 'rejected';
  }

  return 'pending';
}

async function findPaymentForWebhook({
  action,
  db,
  mercadoPagoId,
  mpPayment,
  mpOrder,
  logger,
}: {
  action: string;
  db: Firestore;
  mercadoPagoId: string;
  mpPayment: MercadoPagoPaymentClient;
  mpOrder?: MercadoPagoOrderClient;
  logger: PaymentWebhookLogger;
}) {
  const isOrderEvent = action.startsWith('order.');

  if (isOrderEvent) {
    if (!mpOrder) {
      logger.warn(`Order webhook ${mercadoPagoId} ignored because order client is not configured`);
      return { paymentDoc: null, status: null, reason: 'order_client_not_configured' };
    }

    const order = await mpOrder.get({ id: mercadoPagoId });
    if (!order) {
      logger.warn(`Order ${mercadoPagoId} not found in Mercado Pago`);
      return { paymentDoc: null, status: null, reason: 'mercado_pago_order_not_found' };
    }

    const paymentDoc = await findPaymentByExternalIdentifier({
      db,
      externalPaymentId: mercadoPagoId,
    });

    if (!paymentDoc) {
      logger.warn(`No payment document found for Mercado Pago order ${mercadoPagoId}`);
      return { paymentDoc: null, status: null, reason: 'payment_not_found' };
    }

    return { paymentDoc, status: getOrdersApiStatus(order), reason: null };
  }

  const mpData = await mpPayment.get({ id: Number(mercadoPagoId) });
  if (!mpData) {
    logger.warn(`Payment ${mercadoPagoId} not found in Mercado Pago`);
    return { paymentDoc: null, status: null, reason: 'mercado_pago_payment_not_found' };
  }

  const paymentDoc = await findPaymentByExternalIdentifier({
    db,
    externalPaymentId: mercadoPagoId,
  });

  if (!paymentDoc) {
    logger.warn(`No payment document found for externalPaymentId ${mercadoPagoId}`);
    return { paymentDoc: null, status: null, reason: 'payment_not_found' };
  }

  return { paymentDoc, status: mpData.status ?? null, reason: null };
}

export async function processPaymentWebhook({
  body,
  db,
  mpPayment,
  mpOrder,
  logger,
}: {
  body: PaymentWebhookBody;
  db: Firestore;
  mpPayment: MercadoPagoPaymentClient;
  mpOrder?: MercadoPagoOrderClient;
  logger: PaymentWebhookLogger;
}) {
  const { action, data } = body;

  if (!action || (!action.startsWith('payment.') && !action.startsWith('order.'))) {
    return { processed: false, reason: 'ignored_event' };
  }

  const mercadoPagoId = data?.id;
  if (!mercadoPagoId) {
    logger.warn('Webhook received without Mercado Pago ID');
    return { processed: false, reason: 'missing_payment_id' };
  }

  const externalPaymentId = String(mercadoPagoId);
  logger.info(`Processing webhook for Mercado Pago ID ${externalPaymentId}, action: ${action}`);

  const webhookPayment = await findPaymentForWebhook({
    action,
    db,
    mercadoPagoId: externalPaymentId,
    mpPayment,
    mpOrder,
    logger,
  });
  if (!webhookPayment.paymentDoc || !webhookPayment.status) {
    return { processed: false, reason: webhookPayment.reason ?? 'payment_not_found' };
  }

  const paymentDoc = webhookPayment.paymentDoc;
  const paymentData = paymentDoc.data();

  if (paymentData.webhookReceivedAt) {
    logger.info(`Payment ${externalPaymentId} already processed, skipping`);
    return { processed: false, reason: 'already_processed' };
  }

  const batch = db.batch();
  const mpStatus = webhookPayment.status;

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
      const qualifierRegistrationId = String(paymentData.qualifierRegistrationId);
      const registrationRef = db
        .collection('qualifierRegistrations')
        .doc(qualifierRegistrationId);
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
        const userId = registration.userId ? String(registration.userId) : null;

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
          db.collection('qualifierParticipants').doc(qualifierRegistrationId),
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
        if (userId && POINTS_TABLE.qualifierEntry > 0) {
          batch.update(
            db.collection('users').doc(userId),
            buildQualifierEntryPointsUpdate(category, seasonKey),
          );
          batch.set(
            db.doc(getSeasonRankingPath(seasonKey, userId)),
            buildSeasonRankingIncrement({
              user: participantUser ?? {},
              seasonId: seasonKey,
              category,
              points: POINTS_TABLE.qualifierEntry,
            }),
            { merge: true },
          );
          const pointActivity = buildQualifierEntryPointActivity({
            userId,
            registrationId: qualifierRegistrationId,
            region: String(registration.region),
            category,
            seasonId: seasonKey,
          });
          batch.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
        }
      }
    }

    if (paymentData.battleId) {
      const battleRef = db.collection('battles').doc(paymentData.battleId);
      const prizeShares = getBattlePrizeShares(Number(paymentData.amount ?? 0));
      batch.update(battleRef, {
        currentParticipants: FieldValue.increment(1),
        prizePool: FieldValue.increment(prizeShares.prizePool),
        'prizeDistribution.first': FieldValue.increment(prizeShares.first),
        'prizeDistribution.second': FieldValue.increment(prizeShares.second),
        'prizeDistribution.third': FieldValue.increment(prizeShares.third),
        platformFeeTotal: FieldValue.increment(Number(paymentData.amount ?? 0) - prizeShares.prizePool),
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
