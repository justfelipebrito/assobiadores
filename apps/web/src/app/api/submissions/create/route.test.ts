import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../server/api-errors';

const getAdminFirestore = vi.fn();
const getAdminStorageBucket = vi.fn();
const requireDecodedToken = vi.fn();
const createSubmission = vi.fn();
const uploadBattleSubmissionAudio = vi.fn();

const bucket = {
  file: vi.fn(() => ({
    delete: vi.fn(async () => undefined),
  })),
};

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
  getAdminStorageBucket,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/daily-highlight-audio-service', () => ({
  uploadBattleSubmissionAudio,
}));

vi.mock('../../../../server/submission-service', () => ({
  createSubmission,
}));

function createFormData() {
  const formData = new FormData();
  formData.append('battleId', 'battle-1');
  formData.append('category', 'freestyle');
  formData.append('durationSeconds', '5');
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'assobio.webm');
  return formData;
}

async function post(body: BodyInit = createFormData()) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/submissions/create', {
      method: 'POST',
      body,
    }) as never,
  );
}

describe('POST /api/submissions/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    getAdminStorageBucket.mockReturnValue(bucket);
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    uploadBattleSubmissionAudio.mockResolvedValue({
      audioURL: 'https://storage.example/battle.webm',
      audioPath: 'battle-submissions/battle-1/user-1.webm',
    });
    createSubmission.mockResolvedValue({ submissionId: 'submission-1', status: 'approved' });
  });

  it('creates an audio submission for the authenticated user', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({
      submissionId: 'submission-1',
      status: 'approved',
    });
    expect(res.status).toBe(200);
    expect(uploadBattleSubmissionAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket,
        userId: 'user-1',
        battleId: 'battle-1',
        contentType: 'audio/webm',
      }),
    );
    expect(createSubmission).toHaveBeenCalledWith('db', {
      battleId: 'battle-1',
      userId: 'user-1',
      audioURL: 'https://storage.example/battle.webm',
      audioPath: 'battle-submissions/battle-1/user-1.webm',
      contentType: 'audio/webm',
      sizeBytes: 5,
      durationSeconds: 5,
      category: 'freestyle',
    });
  });

  it('returns auth and service errors with their status code', async () => {
    requireDecodedToken.mockRejectedValue(new ApiError(401, 'Nao autorizado'));

    const authRes = await post();

    await expect(authRes.json()).resolves.toEqual({ error: 'Nao autorizado' });
    expect(authRes.status).toBe(401);

    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    createSubmission.mockRejectedValue(new ApiError(409, 'Voce ja enviou um audio para esta batalha'));

    const serviceRes = await post();

    await expect(serviceRes.json()).resolves.toEqual({
      error: 'Voce ja enviou um audio para esta batalha',
    });
    expect(serviceRes.status).toBe(409);
  });

  it('requires recorded audio form data', async () => {
    const formData = new FormData();
    formData.append('battleId', 'battle-1');
    formData.append('category', 'freestyle');

    const res = await post(formData);

    await expect(res.json()).resolves.toEqual({ error: 'Grave um audio antes de enviar' });
    expect(res.status).toBe(400);
    expect(createSubmission).not.toHaveBeenCalled();
  });
});
