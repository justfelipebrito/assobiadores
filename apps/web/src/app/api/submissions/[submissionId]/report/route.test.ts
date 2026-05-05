import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const requireDecodedToken = vi.fn();
const reportSubmission = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
}));

vi.mock('../../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../../server/submission-service', () => ({
  reportSubmission,
}));

async function post(body: unknown = { reason: 'platform_rules' }) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/submissions/submission-1/report', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never,
    { params: { submissionId: 'submission-1' } },
  );
}

describe('POST /api/submissions/[submissionId]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    reportSubmission.mockResolvedValue({ reportId: 'report-1', status: 'open' });
  });

  it('creates a report for the authenticated user', async () => {
    const res = await post({ reason: 'platform_rules', description: 'Fora das regras' });

    await expect(res.json()).resolves.toEqual({ reportId: 'report-1', status: 'open' });
    expect(res.status).toBe(200);
    expect(reportSubmission).toHaveBeenCalledWith('db', {
      submissionId: 'submission-1',
      reporterId: 'user-1',
      reason: 'platform_rules',
      description: 'Fora das regras',
    });
  });

  it('returns service errors with their status code', async () => {
    reportSubmission.mockRejectedValue(new ApiError(409, 'Voce ja denunciou este envio'));

    const res = await post();

    await expect(res.json()).resolves.toEqual({ error: 'Voce ja denunciou este envio' });
    expect(res.status).toBe(409);
  });
});
