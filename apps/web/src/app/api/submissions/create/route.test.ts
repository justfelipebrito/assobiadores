import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const createSubmission = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/submission-service', () => ({
  createSubmission,
}));

async function post(body: unknown = { battleId: 'battle-1', videoURL: 'https://youtu.be/abc', title: 'Video' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/submissions/create', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/submissions/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    createSubmission.mockResolvedValue({ submissionId: 'submission-1', status: 'submitted' });
  });

  it('creates a submission for the authenticated user', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({
      submissionId: 'submission-1',
      status: 'submitted',
    });
    expect(res.status).toBe(200);
    expect(createSubmission).toHaveBeenCalledWith('db', {
      battleId: 'battle-1',
      userId: 'user-1',
      videoURL: 'https://youtu.be/abc',
      title: 'Video',
      description: '',
    });
  });

  it('returns auth and service errors with their status code', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));

    const authRes = await post();

    await expect(authRes.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(authRes.status).toBe(401);

    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    createSubmission.mockRejectedValue(new ApiError(409, 'Voce ja enviou um video para esta batalha'));

    const serviceRes = await post();

    await expect(serviceRes.json()).resolves.toEqual({
      error: 'Voce ja enviou um video para esta batalha',
    });
    expect(serviceRes.status).toBe(409);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await post('{');

    await expect(res.json()).resolves.toEqual({ error: 'JSON invalido' });
    expect(res.status).toBe(400);
    expect(createSubmission).not.toHaveBeenCalled();
  });
});
