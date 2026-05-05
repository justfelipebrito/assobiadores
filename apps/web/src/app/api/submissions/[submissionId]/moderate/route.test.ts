import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const removeSubmission = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../../server/submission-service', () => ({
  removeSubmission,
}));

async function post(body: unknown = { action: 'remove' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/submissions/submission-1/moderate', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
    { params: { submissionId: 'submission-1' } },
  );
}

describe('POST /api/submissions/[submissionId]/moderate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'admin-1' });
    removeSubmission.mockResolvedValue({ submissionId: 'submission-1', status: 'removed' });
  });

  it('removes a submission as the authenticated admin', async () => {
    const res = await post({ action: 'remove', moderationNote: 'Fora das regras' });

    await expect(res.json()).resolves.toEqual({
      submissionId: 'submission-1',
      status: 'removed',
    });
    expect(res.status).toBe(200);
    expect(removeSubmission).toHaveBeenCalledWith('db', {
      submissionId: 'submission-1',
      moderatorId: 'admin-1',
      moderationNote: 'Fora das regras',
    });
  });

  it('rejects invalid actions', async () => {
    const res = await post({ status: 'submitted' });

    await expect(res.json()).resolves.toEqual({ error: 'acao invalida' });
    expect(res.status).toBe(400);
    expect(removeSubmission).not.toHaveBeenCalled();
  });

  it('returns service authorization errors', async () => {
    removeSubmission.mockRejectedValue(new ApiError(403, 'Apenas administradores podem moderar submissoes'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Apenas administradores podem moderar submissoes',
    });
    expect(res.status).toBe(403);
  });
});
