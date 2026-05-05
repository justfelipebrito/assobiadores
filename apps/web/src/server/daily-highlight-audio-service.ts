import { randomUUID } from 'node:crypto';
import type { CompetitionCategory } from '@batalha/types';
import { DAILY_HIGHLIGHT_MAX_AUDIO_BYTES } from '@batalha/types';
import { ApiError } from './api-errors';

type AudioBucket = {
  name: string;
  file: (path: string) => {
    save: (buffer: Buffer, options?: any) => Promise<unknown>;
    delete: () => Promise<unknown>;
  };
};

function getDownloadUrl(bucket: AudioBucket, path: string, token: string) {
  const encodedPath = encodeURIComponent(path);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const host = emulatorHost ? `http://${emulatorHost}` : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

function getExtension(contentType: string) {
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('mp4')) return 'm4a';
  return 'webm';
}

export async function uploadDailyHighlightAudio({
  bucket,
  userId,
  buffer,
  contentType,
  category,
}: {
  bucket: AudioBucket;
  userId: string;
  buffer: Buffer;
  contentType: string;
  category: CompetitionCategory;
}) {
  if (!contentType.startsWith('audio/')) {
    throw new ApiError(400, 'Envie um audio valido');
  }
  if (buffer.length > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }

  const token = randomUUID();
  const path = `daily-highlights/${userId}/${Date.now()}-${category}.${getExtension(contentType)}`;
  const file = bucket.file(path);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return {
    audioURL: getDownloadUrl(bucket, path, token),
    audioPath: path,
  };
}

export async function uploadQualifierSubmissionAudio({
  bucket,
  userId,
  matchId,
  buffer,
  contentType,
}: {
  bucket: AudioBucket;
  userId: string;
  matchId: string;
  buffer: Buffer;
  contentType: string;
}) {
  if (!contentType.startsWith('audio/')) {
    throw new ApiError(400, 'Envie um audio valido');
  }
  if (buffer.length > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }

  const token = randomUUID();
  const path = `qualifier-submissions/${matchId}/${userId}-${Date.now()}.${getExtension(contentType)}`;
  const file = bucket.file(path);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return {
    audioURL: getDownloadUrl(bucket, path, token),
    audioPath: path,
  };
}

export async function uploadBattleSubmissionAudio({
  bucket,
  userId,
  battleId,
  buffer,
  contentType,
}: {
  bucket: AudioBucket;
  userId: string;
  battleId: string;
  buffer: Buffer;
  contentType: string;
}) {
  if (!contentType.startsWith('audio/')) {
    throw new ApiError(400, 'Envie um audio valido');
  }
  if (buffer.length > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }

  const token = randomUUID();
  const path = `battle-submissions/${battleId}/${userId}-${Date.now()}.${getExtension(contentType)}`;
  const file = bucket.file(path);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return {
    audioURL: getDownloadUrl(bucket, path, token),
    audioPath: path,
  };
}
