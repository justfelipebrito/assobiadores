import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const createQualifierVote = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../../server/qualifier-vote-service', () => ({ createQualifierVote }));

async function post(body: unknown) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/qualifiers/matches/match-1/vote', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify(body),
    }) as never,
    { params: { matchId: 'match-1' } },
  );
}

describe('POST /api/qualifiers/matches/[matchId]/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    requireDecodedToken.mockResolvedValue({ uid: 'voter-1' });
    createQualifierVote.mockResolvedValue({ qualifierVoteId: 'vote-1' });
  });

  it('creates a qualifier vote for the authenticated user', async () => {
    const res = await post({ submissionId: 'submission-1' });

    await expect(res.json()).resolves.toEqual({ qualifierVoteId: 'vote-1' });
    expect(res.status).toBe(200);
    expect(createQualifierVote).toHaveBeenCalledWith(
      { db: true },
      { matchId: 'match-1', submissionId: 'submission-1', voterId: 'voter-1' },
    );
  });
});
