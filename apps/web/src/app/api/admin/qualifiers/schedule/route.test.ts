import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const updateAllQualifierSchedules = vi.fn();
const updateQualifierSchedule = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../../server/qualifier-schedule-service', () => ({
  updateAllQualifierSchedules,
  updateQualifierSchedule,
}));

async function patch(body: unknown) {
  const { PATCH } = await import('./route');

  return PATCH(
    new Request('http://localhost/api/admin/qualifiers/schedule', {
      method: 'PATCH',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('PATCH /api/admin/qualifiers/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    updateAllQualifierSchedules.mockResolvedValue({
      trackCount: 15,
      rescheduledMatchCount: 9,
    });
    updateQualifierSchedule.mockResolvedValue({
      trackId: 'qualifier-sp-2026-freestyle',
      rescheduledMatchCount: 2,
    });
  });

  it('updates qualifier schedule through the trusted service', async () => {
    const res = await patch({
      region: 'SP',
      category: 'freestyle',
      registrationDeadline: '2026-05-31T23:59:00.000Z',
      bracketStart: '2026-06-01T03:00:00.000Z',
      bracketEnd: '2026-07-13T02:59:00.000Z',
    });

    await expect(res.json()).resolves.toEqual({
      trackId: 'qualifier-sp-2026-freestyle',
      rescheduledMatchCount: 2,
    });
    expect(res.status).toBe(200);
    expect(updateQualifierSchedule).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
        registrationDeadline: expect.any(Date),
        bracketStart: expect.any(Date),
        bracketEnd: expect.any(Date),
      }),
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('updates all qualifier schedules through the trusted service', async () => {
    const res = await patch({
      scope: 'all',
      registrationDeadline: '2026-05-31T23:59:00.000Z',
      bracketStart: '2026-06-01T03:00:00.000Z',
      bracketEnd: '2026-07-13T02:59:00.000Z',
    });

    await expect(res.json()).resolves.toEqual({
      trackCount: 15,
      rescheduledMatchCount: 9,
    });
    expect(res.status).toBe(200);
    expect(updateAllQualifierSchedules).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({
        adminUserId: 'admin-1',
        registrationDeadline: expect.any(Date),
        bracketStart: expect.any(Date),
        bracketEnd: expect.any(Date),
      }),
    );
    expect(updateQualifierSchedule).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before calling the service', async () => {
    const res = await patch({
      region: 'XX',
      category: 'invalid',
      registrationDeadline: '2026-05-31T23:59:00.000Z',
      bracketStart: '2026-06-01T03:00:00.000Z',
      bracketEnd: '2026-07-13T02:59:00.000Z',
    });

    await expect(res.json()).resolves.toEqual({ error: 'Estado e obrigatorio' });
    expect(res.status).toBe(400);
    expect(updateQualifierSchedule).not.toHaveBeenCalled();
    expect(updateAllQualifierSchedules).not.toHaveBeenCalled();
  });
});
