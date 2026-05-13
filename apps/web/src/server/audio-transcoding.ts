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
