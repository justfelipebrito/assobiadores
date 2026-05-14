import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { getAdminReferralAnalytics } from './admin-analytics-service';

function createDoc(data: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

function createDb({ adminRole = 'admin' } = {}) {
  const docs = [
    createDoc({ refCode: 'absoluteassobio' }),
    createDoc({ refCode: 'absoluteassobio' }),
    createDoc({ refCode: null }),
  ];

  return {
    collection: vi.fn((name: string) => {
      if (name !== 'users') throw new Error(`Unexpected collection ${name}`);
      return {
        doc: vi.fn(() => ({
          get: vi.fn(async () => createDoc({ role: adminRole })),
        })),
        get: vi.fn(async () => ({ docs, size: docs.length })),
      };
    }),
  };
}

describe('getAdminReferralAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines GA referral captures with Firestore attributed users', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rows: [
            {
              dimensionValues: [{ value: 'absoluteassobio' }],
              metricValues: [{ value: '12' }, { value: '10' }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rows: [{ metricValues: [{ value: '30' }] }],
        }),
      });

    const result = await getAdminReferralAnalytics({
      db: createDb() as never,
      adminUserId: 'admin-1',
      env: {
        GA_PROPERTY_ID: '123',
        GA_CLIENT_EMAIL: 'analytics@example.iam.gserviceaccount.com',
        GA_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      },
      fetchImpl: fetchImpl as never,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.available).toBe(true);
    expect(result.totals).toEqual({
      visitors: 30,
      referralCaptures: 12,
      attributedUsers: 3,
    });
    expect(result.byRef).toHaveLength(2);
    expect(result.byRef.find((row) => row.ref === 'absoluteassobio')).toMatchObject({
      ref: 'absoluteassobio',
      visitors: 10,
      referralCaptures: 12,
      attributedUsers: 2,
      conversionRate: 0.2,
    });
    expect(result.byRef.find((row) => row.ref === 'organic')).toMatchObject({
      ref: 'organic',
      visitors: 20,
      referralCaptures: 0,
      attributedUsers: 1,
      conversionRate: 0.05,
    });
  });

  it('returns Firestore signup attribution when GA is not configured', async () => {
    const result = await getAdminReferralAnalytics({
      db: createDb() as never,
      adminUserId: 'admin-1',
      env: {},
      fetchImpl: vi.fn() as never,
    });

    expect(result.available).toBe(false);
    expect(result.totals.attributedUsers).toBe(3);
    expect(result.byRef.find((row) => row.ref === 'absoluteassobio')?.attributedUsers).toBe(2);
    expect(result.byRef.find((row) => row.ref === 'organic')?.attributedUsers).toBe(1);
    expect(result.unavailableReason).toContain('GA_PROPERTY_ID');
  });

  it('rejects non-admin users', async () => {
    await expect(
      getAdminReferralAnalytics({
        db: createDb({ adminRole: 'user' }) as never,
        adminUserId: 'user-1',
        env: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
