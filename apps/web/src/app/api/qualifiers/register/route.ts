import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import {
  brazilStateSchema,
  competitionCategorySchema,
  type CompetitionCategory,
} from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import {
  createMercadoPagoPixOrder,
  MercadoPagoOrderError,
} from '../../../../server/mercado-pago-orders';
import { readJsonObject } from '../../../../server/request';
import { getQualifierDailyMatchLimit } from '../../../../lib/qualifier-bracket';
import {
  getQualifierTrackId,
  getQualifierTrackSlug,
  QUALIFIER_SEASON_YEAR,
} from '../../../../lib/qualifier-tracks';

const QUALIFIER_SEASON_ID = 'season-2026';
const QUALIFIER_ENTRY_FEE_CENTS = 400;
const QUALIFIER_PLATFORM_FEE_PERCENT = 20;
const QUALIFIER_PRIZE_POOL_PERCENT = 80;
const QUALIFIER_REGISTRATION_DEADLINE = Timestamp.fromDate(new Date('2026-05-31T23:59:59-03:00'));
const QUALIFIER_BRACKET_START = Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00'));
const QUALIFIER_BRACKET_END = Timestamp.fromDate(new Date('2026-07-12T23:59:59-03:00'));

function getMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const userId = decodedToken.uid;
    const body = await readJsonObject(req);

    const categoryResult = competitionCategorySchema.safeParse(body.category);

    if (!categoryResult.success) {
      throw new ApiError(400, 'Categoria e obrigatoria');
    }

    const category = categoryResult.data;
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() ?? {};
    const regionResult = brazilStateSchema.safeParse(userData.birthState);

    if (!regionResult.success) {
      throw new ApiError(
        400,
        'Complete sua naturalidade no perfil para entrar nas classificatorias',
      );
    }

    const region = regionResult.data;

    const existingRegistrationQuery = await db
      .collection('qualifierRegistrations')
      .where('userId', '==', userId)
      .where('seasonId', '==', QUALIFIER_SEASON_ID)
      .where('category', '==', category)
      .where('region', '==', region)
      .where('status', 'in', ['pending_payment', 'confirmed'])
      .limit(1)
      .get();

    if (!existingRegistrationQuery.empty) {
      const registrationDoc = existingRegistrationQuery.docs[0]!;
      const registration = registrationDoc.data();

      if (registration.status === 'confirmed') {
        throw new ApiError(
          409,
          'Sua inscricao ja esta confirmada nesta categoria. Escolha outra categoria para gerar um novo Pix.',
        );
      }

      if (registration.paymentId) {
        const paymentDoc = await db.collection('payments').doc(registration.paymentId).get();
        const payment = paymentDoc.data();
        const expiresAtMillis = getMillis(payment?.expiresAt);

        if (
          paymentDoc.exists &&
          payment?.status === 'pending' &&
          (!expiresAtMillis || expiresAtMillis > Date.now())
        ) {
          const expiresAt = payment.expiresAt?.toDate
            ? payment.expiresAt.toDate().toISOString()
            : payment.expiresAt instanceof Date
              ? payment.expiresAt.toISOString()
              : payment.expiresAt;

          return NextResponse.json({
            paymentId: paymentDoc.id,
            registrationId: registrationDoc.id,
            pixQrCode: payment.pixQrCode,
            pixCopiaECola: payment.pixCopiaECola,
            expiresAt,
          });
        }
      }

      await registrationDoc.ref.update({
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const userEmail = userData.email || decodedToken.email || '';
    const registrationRef = db.collection('qualifierRegistrations').doc();
    const paymentRef = db.collection('payments').doc();
    const idempotencyKey = `${userId}_qualifier_${QUALIFIER_SEASON_ID}_${region}_${category}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const mpResult = await createMercadoPagoPixOrder({
      amountInCents: QUALIFIER_ENTRY_FEE_CENTS,
      payerEmail: userEmail,
      idempotencyKey,
    });

    const batch = db.batch();
    const qualifierTrackRef = db
      .collection('qualifierTracks')
      .doc(getQualifierTrackId(region, category));
    batch.set(registrationRef, {
      id: registrationRef.id,
      userId,
      seasonId: QUALIFIER_SEASON_ID,
      category: category as CompetitionCategory,
      region,
      status: 'pending_payment',
      bracketStatus: 'registered',
      currentRound: 0,
      currentMatchId: null,
      matchIds: [],
      qualifiedChampionshipId: null,
      entryFeeCents: QUALIFIER_ENTRY_FEE_CENTS,
      platformFeePercent: QUALIFIER_PLATFORM_FEE_PERCENT,
      prizePoolPercent: QUALIFIER_PRIZE_POOL_PERCENT,
      paymentId: paymentRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(paymentRef, {
      id: paymentRef.id,
      provider: 'mercado_pago_orders',
      externalId: mpResult.orderId,
      externalPaymentId: mpResult.paymentId,
      userId,
      targetType: 'qualifier_registration',
      targetId: registrationRef.id,
      battleId: null,
      entryId: null,
      qualifierRegistrationId: registrationRef.id,
      amount: QUALIFIER_ENTRY_FEE_CENTS,
      status: 'pending',
      pixQrCode: mpResult.pixQrCode,
      pixCopiaECola: mpResult.pixCopiaECola,
      idempotencyKey,
      webhookReceivedAt: null,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      qualifierTrackRef,
      {
        id: qualifierTrackRef.id,
        slug: getQualifierTrackSlug(region, category),
        seasonId: QUALIFIER_SEASON_ID,
        seasonYear: QUALIFIER_SEASON_YEAR,
        category,
        region,
        status: 'registration_open',
        entryFeeCents: QUALIFIER_ENTRY_FEE_CENTS,
        registrationDeadline: QUALIFIER_REGISTRATION_DEADLINE,
        bracketStart: QUALIFIER_BRACKET_START,
        bracketEnd: QUALIFIER_BRACKET_END,
        maxQualified: 64,
        dailyMatchLimit: getQualifierDailyMatchLimit(0),
        plannedMatchDays: 0,
        plannedMatchCount: 0,
        currentRound: 0,
        registeredCount: FieldValue.increment(1),
        pendingPaymentCount: FieldValue.increment(1),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();

    return NextResponse.json({
      paymentId: paymentRef.id,
      registrationId: registrationRef.id,
      pixQrCode: mpResult.pixQrCode,
      pixCopiaECola: mpResult.pixCopiaECola,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof MercadoPagoOrderError) {
      console.error('Qualifier registration Mercado Pago order rejected:', JSON.stringify({
        status: error.status,
        responseBody: error.responseBody,
      }));
    } else if (!(error instanceof ApiError)) {
      console.error('Qualifier registration payment error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao criar pagamento da classificatoria');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
