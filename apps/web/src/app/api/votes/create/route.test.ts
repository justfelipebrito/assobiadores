import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const createVote = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/vote-service', () => ({
  createVote,
}));

async function post(body: unknown = { battleId: 'battle-1', submissionId: 'submission-1' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/votes/create', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/votes/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    createVote.mockResolvedValue({ voteId: 'vote-1' });
  });

  it('creates a vote for the authenticated user', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({ voteId: 'vote-1' });
    expect(res.status).toBe(200);
    expect(createVote).toHaveBeenCalledWith('db', {
      battleId: 'battle-1',
      submissionId: 'submission-1',
      voterId: 'user-1',
    });
  });

  it('returns duplicate vote errors', async () => {
    createVote.mockRejectedValue(new ApiError(409, 'Voce ja votou nesta batalha'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Voce ja votou nesta batalha' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await post('{');

    await expect(res.json()).resolves.toEqual({ error: 'JSON invalido' });
    expect(res.status).toBe(400);
    expect(createVote).not.toHaveBeenCalled();
  });
});
