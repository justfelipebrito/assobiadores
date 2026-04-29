import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const createFreeBattleEntry = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/battle-entry-service', () => ({
  createFreeBattleEntry,
}));

async function post(body: unknown = { battleId: 'battle-1' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/battle-entries/free', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/battle-entries/free', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    createFreeBattleEntry.mockResolvedValue({ entryId: 'entry-1' });
  });

  it('creates a free battle entry for the authenticated user', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({ entryId: 'entry-1' });
    expect(res.status).toBe(200);
    expect(createFreeBattleEntry).toHaveBeenCalledWith('db', {
      battleId: 'battle-1',
      userId: 'user-1',
    });
  });

  it('returns 401 when auth verification fails', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(res.status).toBe(401);
    expect(createFreeBattleEntry).not.toHaveBeenCalled();
  });

  it('returns service errors with their status code', async () => {
    createFreeBattleEntry.mockRejectedValue(new ApiError(409, 'Batalha lotada'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Batalha lotada' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await post('{');

    await expect(res.json()).resolves.toEqual({ error: 'JSON invalido' });
    expect(res.status).toBe(400);
    expect(createFreeBattleEntry).not.toHaveBeenCalled();
  });

  it('masks unexpected errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createFreeBattleEntry.mockRejectedValue(new Error('database detail'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Erro ao participar. Tente novamente.' });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('Free battle entry error:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
