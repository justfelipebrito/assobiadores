import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const getAdminStorageBucket = vi.fn();
const requireDecodedToken = vi.fn();
const uploadQualifierSubmissionAudio = vi.fn();
const createQualifierSubmission = vi.fn();
const deleteUploadedFile = vi.fn();
const detectAudioDurationSeconds = vi.fn();
const getResolvedAudioDurationSeconds = vi.fn(
  ({
    detectedDurationSeconds,
    clientDurationSeconds,
  }: {
    detectedDurationSeconds?: number | null;
    clientDurationSeconds?: number | null;
  }) => Math.round(detectedDurationSeconds ?? clientDurationSeconds ?? 0),
);

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
  getAdminStorageBucket,
}));

vi.mock('../../../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../../../server/daily-highlight-audio-service', () => ({
  uploadQualifierSubmissionAudio,
}));

vi.mock('../../../../../../server/audio-transcoding', () => ({
  detectAudioDurationSeconds,
  getResolvedAudioDurationSeconds,
}));

vi.mock('../../../../../../server/qualifier-submission-service', () => ({
  createQualifierSubmission,
}));

async function post() {
  const { POST } = await import('./route');
  const formData = new FormData();
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'assobio.webm');
  formData.append('durationSeconds', '12');

  return POST(
    new Request('http://localhost/api/qualifiers/matches/match-1/submit', {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: formData,
    }) as never,
    { params: { matchId: 'match-1' } },
  );
}

describe('POST /api/qualifiers/matches/[matchId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue({ db: true });
    getAdminStorageBucket.mockReturnValue({
      file: vi.fn(() => ({ delete: deleteUploadedFile.mockResolvedValue(undefined) })),
    });
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    detectAudioDurationSeconds.mockResolvedValue(null);
    uploadQualifierSubmissionAudio.mockResolvedValue({
      audioURL: 'https://storage.example/audio-playback.m4a',
      audioPath: 'qualifier-submissions/match-1/user-1-playback.m4a',
      contentType: 'audio/mp4',
      sizeBytes: 4,
      originalAudioURL: 'https://storage.example/audio.webm',
      originalAudioPath: 'qualifier-submissions/match-1/user-1.webm',
      originalContentType: 'audio/webm',
      originalSizeBytes: 5,
    });
    createQualifierSubmission.mockResolvedValue({
      qualifierSubmissionId: 'submission-1',
      matchId: 'match-1',
    });
  });

  it('uploads audio and creates a guarded qualifier submission', async () => {
    const res = await post();

    await expect(res.json()).resolves.toEqual({
      qualifierSubmissionId: 'submission-1',
      matchId: 'match-1',
    });
    expect(res.status).toBe(200);
    expect(uploadQualifierSubmissionAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        matchId: 'match-1',
        contentType: 'audio/webm',
      }),
    );
    expect(createQualifierSubmission).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({
        matchId: 'match-1',
        userId: 'user-1',
        audioURL: 'https://storage.example/audio-playback.m4a',
        audioPath: 'qualifier-submissions/match-1/user-1-playback.m4a',
        contentType: 'audio/mp4',
        sizeBytes: 4,
        originalAudioURL: 'https://storage.example/audio.webm',
        originalAudioPath: 'qualifier-submissions/match-1/user-1.webm',
        originalContentType: 'audio/webm',
        originalSizeBytes: 5,
        durationSeconds: 12,
      }),
    );
  });

  it('prefers server-detected audio duration over the client stopwatch', async () => {
    detectAudioDurationSeconds.mockResolvedValue(15.6);

    const res = await post();

    expect(res.status).toBe(200);
    expect(getResolvedAudioDurationSeconds).toHaveBeenCalledWith({
      detectedDurationSeconds: 15.6,
      clientDurationSeconds: 12,
    });
    expect(createQualifierSubmission).toHaveBeenCalledWith(
      { db: true },
      expect.objectContaining({
        durationSeconds: 16,
      }),
    );
  });

  it('deletes uploaded audio if the database write is rejected', async () => {
    createQualifierSubmission.mockRejectedValueOnce(
      Object.assign(new Error('Voce ja enviou seu assobio para este confronto'), { status: 409 }),
    );

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      error: 'Erro ao enviar assobio. Tente novamente.',
    });
    expect(res.status).toBe(500);
    expect(deleteUploadedFile).toHaveBeenCalled();
  });
});
