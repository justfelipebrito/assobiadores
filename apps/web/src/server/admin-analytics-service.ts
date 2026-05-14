import { createSign } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { PARTNER_REFERRALS } from '../lib/partner-referrals';
import { ApiError } from './api-errors';

type AnalyticsEnv = {
  GA_PROPERTY_ID?: string;
  GA_CLIENT_EMAIL?: string;
  GA_PRIVATE_KEY?: string;
} & Record<string, string | undefined>;

type FetchLike = typeof fetch;

type ReferralMetric = {
  ref: string;
  partnerName: string;
  visitors: number;
  referralCaptures: number;
  attributedUsers: number;
  conversionRate: number;
};

export type AdminReferralAnalytics = {
  available: boolean;
  rangeLabel: string;
  totals: {
    visitors: number;
    referralCaptures: number;
    attributedUsers: number;
  };
  byRef: ReferralMetric[];
  unavailableReason?: string;
};

const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const ORGANIC_REFERRAL = { code: 'organic', name: 'Orgânico' } as const;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getPrivateKey(value?: string) {
  return value?.replace(/\\n/g, '\n');
}

async function requireAdmin(db: Firestore, adminUserId: string) {
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');
  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem acessar analytics');
  }
}

async function getAttributionCounts(db: Firestore) {
  const snapshot = await db.collection('users').get();
  const counts = new Map<string, number>();
  snapshot.docs.forEach((doc) => {
    const refCode = doc.data().refCode;
    if (typeof refCode === 'string' && refCode.trim()) {
      counts.set(refCode, (counts.get(refCode) ?? 0) + 1);
    }
  });
  return { totalUsers: snapshot.size, byRef: counts };
}

function buildJwt({ clientEmail, privateKey }: { clientEmail: string; privateKey: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: GA_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );
  const input = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(input).sign(privateKey);
  return `${input}.${base64Url(signature)}`;
}

async function getAccessToken({
  env,
  fetchImpl,
}: {
  env: AnalyticsEnv;
  fetchImpl: FetchLike;
}) {
  const clientEmail = env.GA_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey(env.GA_PRIVATE_KEY);
  if (!clientEmail || !privateKey) return null;

  const assertion = buildJwt({ clientEmail, privateKey });
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`GA token request failed with ${response.status}`);
  }
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

async function runGaReferralReport({
  propertyId,
  accessToken,
  fetchImpl,
}: {
  propertyId: string;
  accessToken: string;
  fetchImpl: FetchLike;
}) {
  const response = await fetchImpl(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'customEvent:partner_ref' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'partner_referral_captured' },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GA referral report request failed with ${response.status}: ${body}`);
  }

  return (await response.json()) as {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };
}

async function runGaReferralFallbackReport({
  propertyId,
  accessToken,
  fetchImpl,
}: {
  propertyId: string;
  accessToken: string;
  fetchImpl: FetchLike;
}) {
  const response = await fetchImpl(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'partner_referral_captured' },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GA referral fallback request failed with ${response.status}: ${body}`);
  }

  const body = (await response.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  const row = body.rows?.[0];
  const partner = PARTNER_REFERRALS[0];
  if (!row || !partner || PARTNER_REFERRALS.length !== 1) return [];

  return [
    {
      dimensionValues: [{ value: partner.code }],
      metricValues: row.metricValues,
    },
  ];
}

async function runGaTotalReport({
  propertyId,
  accessToken,
  fetchImpl,
}: {
  propertyId: string;
  accessToken: string;
  fetchImpl: FetchLike;
}) {
  const response = await fetchImpl(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GA total report request failed with ${response.status}: ${body}`);
  }

  const body = (await response.json()) as {
    rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
  };
  return Number(body.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

function buildRows({
  attributionCounts,
  gaRows = [],
  totalVisitors = 0,
}: {
  attributionCounts: { totalUsers: number; byRef: Map<string, number> };
  gaRows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  totalVisitors?: number;
}) {
  const gaByRef = new Map<string, { referralCaptures: number; visitors: number }>();
  gaRows.forEach((row) => {
    const ref = row.dimensionValues?.[0]?.value ?? '';
    if (!ref) return;
    gaByRef.set(ref, {
      referralCaptures: Number(row.metricValues?.[0]?.value ?? 0),
      visitors: Number(row.metricValues?.[1]?.value ?? 0),
    });
  });

  const partnerRows = PARTNER_REFERRALS.map((partner) => {
    const ga = gaByRef.get(partner.code) ?? { referralCaptures: 0, visitors: 0 };
    const attributedUsers = attributionCounts.byRef.get(partner.code) ?? 0;
    return {
      ref: partner.code,
      partnerName: partner.name,
      visitors: ga.visitors,
      referralCaptures: ga.referralCaptures,
      attributedUsers,
      conversionRate: ga.visitors > 0 ? attributedUsers / ga.visitors : 0,
    };
  });
  const knownAttributedUsers = partnerRows.reduce((sum, row) => sum + row.attributedUsers, 0);
  const knownVisitors = partnerRows.reduce((sum, row) => sum + row.visitors, 0);
  const organicUsers = Math.max(0, attributionCounts.totalUsers - knownAttributedUsers);
  const organicVisitors = Math.max(0, totalVisitors - knownVisitors);

  return [
    ...partnerRows,
    {
      ref: ORGANIC_REFERRAL.code,
      partnerName: ORGANIC_REFERRAL.name,
      visitors: organicVisitors,
      referralCaptures: 0,
      attributedUsers: organicUsers,
      conversionRate: organicVisitors > 0 ? organicUsers / organicVisitors : 0,
    },
  ];
}

function getGaUnavailableReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return 'GA4 conectado, mas os dados de visitantes nao puderam ser carregados agora.';
}

function isMissingPartnerRefDimension(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('customEvent:partner_ref') || message.includes('partner_ref');
}

function buildUnavailableResponse({
  attributionCounts,
  unavailableReason,
}: {
  attributionCounts: { totalUsers: number; byRef: Map<string, number> };
  unavailableReason: string;
}): AdminReferralAnalytics {
  const byRef = buildRows({ attributionCounts });
  return {
    available: false,
    rangeLabel: 'Ultimos 30 dias',
    totals: {
      visitors: 0,
      referralCaptures: 0,
      attributedUsers: byRef.reduce((sum, row) => sum + row.attributedUsers, 0),
    },
    byRef,
    unavailableReason,
  };
}

export async function getAdminReferralAnalytics({
  db,
  adminUserId,
  env = process.env,
  fetchImpl = fetch,
}: {
  db: Firestore;
  adminUserId: string;
  env?: AnalyticsEnv;
  fetchImpl?: FetchLike;
}): Promise<AdminReferralAnalytics> {
  await requireAdmin(db, adminUserId);

  const attributionCounts = await getAttributionCounts(db);
  const propertyId = env.GA_PROPERTY_ID?.trim();
  let accessToken: string | null = null;
  if (propertyId) {
    try {
      accessToken = await getAccessToken({ env, fetchImpl });
    } catch (error) {
      return buildUnavailableResponse({
        attributionCounts,
        unavailableReason: getGaUnavailableReason(error),
      });
    }
  }

  if (!propertyId || !accessToken) {
    return buildUnavailableResponse({
      attributionCounts,
      unavailableReason: 'Configure GA_PROPERTY_ID, GA_CLIENT_EMAIL e GA_PRIVATE_KEY.',
    });
  }

  let totalVisitors = 0;
  try {
    totalVisitors = await runGaTotalReport({ propertyId, accessToken, fetchImpl });
  } catch (error) {
    return buildUnavailableResponse({
      attributionCounts,
      unavailableReason: getGaUnavailableReason(error),
    });
  }

  let unavailableReason: string | undefined;
  let gaRows: Awaited<ReturnType<typeof runGaReferralReport>>['rows'] = [];
  try {
    const report = await runGaReferralReport({ propertyId, accessToken, fetchImpl });
    gaRows = report.rows;
  } catch (error) {
    if (!isMissingPartnerRefDimension(error)) {
      unavailableReason = getGaUnavailableReason(error);
    }
    try {
      gaRows = await runGaReferralFallbackReport({ propertyId, accessToken, fetchImpl });
    } catch {
      gaRows = [];
    }
  }
  const byRef = buildRows({ attributionCounts, gaRows, totalVisitors });

  return {
    available: true,
    rangeLabel: 'Ultimos 30 dias',
    totals: {
      visitors: byRef.reduce((sum, row) => sum + row.visitors, 0),
      referralCaptures: byRef.reduce((sum, row) => sum + row.referralCaptures, 0),
      attributedUsers: byRef.reduce((sum, row) => sum + row.attributedUsers, 0),
    },
    byRef,
    unavailableReason,
  };
}
