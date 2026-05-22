import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

export const PLAYBACK_AUDIO_CONTENT_TYPE = 'audio/mp4';

function getInputExtension(contentType: string) {
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('mp4') || contentType.includes('aac')) return 'm4a';
  return 'webm';
}

export function needsPlaybackTranscode(contentType: string) {
  const normalized = contentType.toLowerCase();
  return !(normalized.includes('mp4') || normalized.includes('aac'));
}

function parseFfmpegDuration(output: string) {
  const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const duration = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function getResolvedAudioDurationSeconds({
  detectedDurationSeconds,
  clientDurationSeconds,
}: {
  detectedDurationSeconds?: number | null;
  clientDurationSeconds?: number | null;
}) {
  const detected =
    typeof detectedDurationSeconds === 'number' &&
    Number.isFinite(detectedDurationSeconds) &&
    detectedDurationSeconds > 0
      ? detectedDurationSeconds
      : null;
  const client =
    typeof clientDurationSeconds === 'number' &&
    Number.isFinite(clientDurationSeconds) &&
    clientDurationSeconds > 0
      ? clientDurationSeconds
      : null;

  return Math.round(detected ?? client ?? 0);
}

export async function detectAudioDurationSeconds(buffer: Buffer, contentType: string) {
  const binaryPath = ffmpegPath;
  if (!binaryPath) return null;

  const tempDir = await mkdtemp(path.join(tmpdir(), 'assobio-audio-probe-'));
  const inputPath = path.join(tempDir, `input-${randomUUID()}.${getInputExtension(contentType)}`);

  try {
    await writeFile(inputPath, buffer);
    return await new Promise<number | null>((resolve, reject) => {
      const ffmpeg = spawn(binaryPath, ['-hide_banner', '-i', inputPath]);
      let stderr = '';
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        stderr += String(chunk);
      });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', () => {
        resolve(parseFfmpegDuration(stderr));
      });
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function transcodeAudioToM4a(buffer: Buffer, contentType: string) {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new Error('FFmpeg binary is not available for audio transcoding.');
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), 'assobio-audio-'));
  const inputPath = path.join(tempDir, `input-${randomUUID()}.${getInputExtension(contentType)}`);
  const outputPath = path.join(tempDir, `playback-${randomUUID()}.m4a`);

  try {
    await writeFile(inputPath, buffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(binaryPath, [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '48000',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath,
      ]);
      let stderr = '';
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        stderr += String(chunk);
      });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
      });
    });
    return readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
