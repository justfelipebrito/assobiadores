import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminFirestore = vi.fn();
const getAdminStorageBucket = vi.fn();
const requireDecodedToken = vi.fn();
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
const uploadDailyHighlightAudio = vi.fn();
const createDailyHighlightFromAudio = vi.fn();

vi.mock('@batalha/firebase/src/admin', () => ({
  getAdminFirestore,
  getAdminStorageBucket,
}));

vi.mock('../../../../server/auth', () => ({
  requireDecodedToken,
}));

vi.mock('../../../../server/audio-transcoding', () => ({
  detectAudioDurationSeconds,
  getResolvedAudioDurationSeconds,
}));

vi.mock('../../../../server/daily-highlight-audio-service', () => ({
  uploadDailyHighlightAudio,
}));

vi.mock('../../../../server/daily-highlight-service', () => ({
  createDailyHighlightFromAudio,
}));

function createFormData() {
  const formData = new FormData();
  formData.append('category', 'melodia');
  formData.append('durationSeconds', '9');
  formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'assobio.webm');
  return formData;
}

async function post(body: BodyInit = createFormData()) {
  const { POST } = await import('./route');

  return POST(
    new Request('http://localhost/api/daily-highlights/submit', {
      method: 'POST',
      body,
    }) as never,
  );
}

describe('POST /api/daily-highlights/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminFirestore.mockReturnValue('db');
    getAdminStorageBucket.mockReturnValue({
      file: vi.fn(() => ({ delete: vi.fn(async () => undefined) })),
    });
    requireDecodedToken.mockResolvedValue({ uid: 'user-1' });
    detectAudioDurationSeconds.mockResolvedValue(null);
    uploadDailyHighlightAudio.mockResolvedValue({
      audioURL: 'https://storage.example/daily-playback.m4a',
      audioPath: 'daily-highlights/user-1-playback.m4a',
      contentType: 'audio/mp4',
      sizeBytes: 4,
      originalAudioURL: 'https://storage.example/daily.webm',
      originalAudioPath: 'daily-highlights/user-1.webm',
      originalContentType: 'audio/webm',
      originalSizeBytes: 5,
    });
    createDailyHighlightFromAudio.mockResolvedValue({
      dailyHighlightId: 'daily-1',
      pointsAwarded: 1,
    });
  });

  it('prefers server-detected audio duration over the client stopwatch', async () => {
    detectAudioDurationSeconds.mockResolvedValue(11.2);

    const res = await post();

    await expect(res.json()).resolves.toEqual({
      dailyHighlightId: 'daily-1',
      pointsAwarded: 1,
    });
    expect(res.status).toBe(200);
    expect(getResolvedAudioDurationSeconds).toHaveBeenCalledWith({
      detectedDurationSeconds: 11.2,
      clientDurationSeconds: 9,
    });
    expect(createDailyHighlightFromAudio).toHaveBeenCalledWith(
      'db',
      expect.objectContaining({
        durationSeconds: 11,
        category: 'melodia',
      }),
    );
  });
});
