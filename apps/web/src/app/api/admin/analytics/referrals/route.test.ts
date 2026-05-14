import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const getAdminReferralAnalytics = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/admin-analytics-service', () => ({ getAdminReferralAnalytics }));

describe('GET /api/admin/analytics/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    getAdminReferralAnalytics.mockResolvedValue({
      available: false,
      rangeLabel: 'Ultimos 30 dias',
      totals: { visitors: 0, referralCaptures: 0, attributedUsers: 1 },
      byRef: [],
    });
  });

  it('returns admin referral analytics through a trusted route', async () => {
    const { GET } = await import('./route');
    const res = await GET(
      new Request('http://localhost/api/admin/analytics/referrals', {
        headers: { authorization: 'Bearer token' },
      }) as never,
    );

    await expect(res.json()).resolves.toMatchObject({
      totals: { attributedUsers: 1 },
    });
    expect(res.status).toBe(200);
    expect(getAdminReferralAnalytics).toHaveBeenCalledWith({
      db: { db: true },
      adminUserId: 'admin-1',
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
