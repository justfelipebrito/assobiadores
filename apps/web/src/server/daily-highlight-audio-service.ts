import { randomUUID } from 'node:crypto';
import type { CompetitionCategory } from '@batalha/types';
import { DAILY_HIGHLIGHT_MAX_AUDIO_BYTES } from '@batalha/types';
import { ApiError } from './api-errors';
import {
  needsPlaybackTranscode,
  PLAYBACK_AUDIO_CONTENT_TYPE,
  transcodeAudioToM4a,
} from './audio-transcoding';

type AudioBucket = {
  name: string;
  file: (path: string) => {
    save: (buffer: Buffer, options?: any) => Promise<unknown>;
    delete: () => Promise<unknown>;
  };
};

type AudioTranscoder = (buffer: Buffer, contentType: string) => Promise<Buffer>;

function getDownloadUrl(bucket: AudioBucket, path: string, token: string) {
  const encodedPath = encodeURIComponent(path);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const host = emulatorHost ? `http://${emulatorHost}` : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

function getExtension(contentType: string) {
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('mp4') || contentType.includes('aac')) return 'm4a';
  return 'webm';
}

async function saveAudioObject({
  bucket,
  path,
  buffer,
  contentType,
}: {
  bucket: AudioBucket;
  path: string;
  buffer: Buffer;
  contentType: string;
}) {
  const token = randomUUID();
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
    url: getDownloadUrl(bucket, path, token),
    path,
    contentType,
    sizeBytes: buffer.length,
  };
}

async function uploadAudioWithPlayback({
  bucket,
  basePath,
  buffer,
  contentType,
  transcode,
}: {
  bucket: AudioBucket;
  basePath: string;
  buffer: Buffer;
  contentType: string;
  transcode?: AudioTranscoder;
}) {
  if (!contentType.startsWith('audio/')) {
    throw new ApiError(400, 'Envie um audio valido');
  }
  if (buffer.length > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }

  const originalPath = `${basePath}.${getExtension(contentType)}`;
  const original = await saveAudioObject({
    bucket,
    path: originalPath,
    buffer,
    contentType,
  });

  if (!needsPlaybackTranscode(contentType)) {
    return {
      audioURL: original.url,
      audioPath: original.path,
      contentType: original.contentType,
      sizeBytes: original.sizeBytes,
      originalAudioURL: original.url,
      originalAudioPath: original.path,
      originalContentType: original.contentType,
      originalSizeBytes: original.sizeBytes,
    };
  }

  const playbackBuffer = await (transcode ?? transcodeAudioToM4a)(buffer, contentType);
  const playback = await saveAudioObject({
    bucket,
    path: `${basePath}-playback.m4a`,
    buffer: playbackBuffer,
    contentType: PLAYBACK_AUDIO_CONTENT_TYPE,
  });

  return {
    audioURL: playback.url,
    audioPath: playback.path,
    contentType: playback.contentType,
    sizeBytes: playback.sizeBytes,
    originalAudioURL: original.url,
    originalAudioPath: original.path,
    originalContentType: original.contentType,
    originalSizeBytes: original.sizeBytes,
  };
}

export async function uploadDailyHighlightAudio({
  bucket,
  userId,
  buffer,
  contentType,
  category,
  transcode,
}: {
  bucket: AudioBucket;
  userId: string;
  buffer: Buffer;
  contentType: string;
  category: CompetitionCategory;
  transcode?: AudioTranscoder;
}) {
  return uploadAudioWithPlayback({
    bucket,
    basePath: `daily-highlights/${userId}/${Date.now()}-${category}`,
    buffer,
    contentType,
    transcode,
  });
}

export async function uploadQualifierSubmissionAudio({
  bucket,
  userId,
  matchId,
  buffer,
  contentType,
  transcode,
}: {
  bucket: AudioBucket;
  userId: string;
  matchId: string;
  buffer: Buffer;
  contentType: string;
  transcode?: AudioTranscoder;
}) {
  return uploadAudioWithPlayback({
    bucket,
    basePath: `qualifier-submissions/${matchId}/${userId}-${Date.now()}`,
    buffer,
    contentType,
    transcode,
  });
}

export async function uploadBattleSubmissionAudio({
  bucket,
  userId,
  battleId,
  buffer,
  contentType,
  transcode,
}: {
  bucket: AudioBucket;
  userId: string;
  battleId: string;
  buffer: Buffer;
  contentType: string;
  transcode?: AudioTranscoder;
}) {
  return uploadAudioWithPlayback({
    bucket,
    basePath: `battle-submissions/${battleId}/${userId}-${Date.now()}`,
    buffer,
    contentType,
    transcode,
  });
}
