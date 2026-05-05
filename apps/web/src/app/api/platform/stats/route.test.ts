import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const getPlatformStats = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/platform-stats-service', () => ({
  getPlatformStats,
}));

async function get() {
  const { GET } = await import('./route');

  return GET();
}

describe('GET /api/platform/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    getPlatformStats.mockResolvedValue({ users: 203, battles: 4 });
  });

  it('returns aggregate platform counters', async () => {
    const res = await get();

    await expect(res.json()).resolves.toEqual({ users: 203, battles: 4 });
    expect(res.status).toBe(200);
    expect(getPlatformStats).toHaveBeenCalledWith('db');
  });

  it('returns a safe error response when stats cannot be loaded', async () => {
    getPlatformStats.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const res = await get();

    await expect(res.json()).resolves.toEqual({
      error: 'Nao foi possivel carregar os numeros da plataforma',
    });
    expect(res.status).toBe(500);
  });
});
