import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const resolveBattleTieBreak = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({ getAdminFirestore }));
vi.mock('../../../../../server/auth', () => ({ requireDecodedToken }));
vi.mock('../../../../../server/battle-tiebreak-service', () => ({ resolveBattleTieBreak }));

function request(body: unknown) {
  return new Request('http://localhost/api/battles/battle-1/tiebreak', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/battles/[battleId]/tiebreak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'creator-1' });
    resolveBattleTieBreak.mockResolvedValue({ tieBreakVoteId: 'vote-1' });
  });

  it('records a trusted tie-break for the authenticated actor', async () => {
    const { POST } = await import('./route');

    const res = await POST(request({ submissionId: 'submission-1' }) as never, {
      params: { battleId: 'battle-1' },
    });

    await expect(res.json()).resolves.toEqual({ tieBreakVoteId: 'vote-1' });
    expect(resolveBattleTieBreak).toHaveBeenCalledWith('db', {
      actorUserId: 'creator-1',
      battleId: 'battle-1',
      submissionId: 'submission-1',
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('allows admin app preflight requests', async () => {
    const { OPTIONS } = await import('./route');

    const res = OPTIONS();

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('keeps CORS headers on trusted service errors', async () => {
    const { POST } = await import('./route');
    resolveBattleTieBreak.mockRejectedValueOnce(new Error('unexpected'));

    const res = await POST(request({ submissionId: 'submission-1' }) as never, {
      params: { battleId: 'battle-1' },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
