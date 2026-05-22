const { createRequire } = require('module');
const { randomUUID } = require('crypto');
const { mkdtemp, readFile, rm, writeFile } = require('fs/promises');
const { tmpdir } = require('os');
const path = require('path');
const { spawn } = require('child_process');

const requireFromFunctions = createRequire(
  path.join(__dirname, '..', 'firebase', 'functions', 'package.json'),
);
const requireFromWeb = createRequire(path.join(__dirname, '..', 'apps', 'web', 'package.json'));

const { initializeApp, getApps, applicationDefault } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');
const ffmpegPath = requireFromWeb('ffmpeg-static');

const WRITE = process.argv.includes('--write');
const COLLECTIONS = ['submissions', 'qualifierSubmissions', 'dailyHighlights'];

if (getApps().length === 0) {
  const appOptions = {
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      'assobiadores-3f0f6',
  };
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    appOptions.credential = applicationDefault();
  }
  initializeApp(appOptions);
}

const db = getFirestore();

function hasValidDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function parseFfmpegDuration(output) {
  const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;

  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function getExtension(contentType = '') {
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('mp4') || contentType.includes('aac')) return 'm4a';
  return 'webm';
}

async function detectAudioDurationSeconds(buffer, contentType) {
  if (!ffmpegPath) throw new Error('ffmpeg-static is not available');

  const tempDir = await mkdtemp(path.join(tmpdir(), 'assobio-audio-backfill-'));
  const inputPath = path.join(tempDir, `input-${randomUUID()}.${getExtension(contentType)}`);

  try {
    await writeFile(inputPath, buffer);
    return await new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, ['-hide_banner', '-i', inputPath]);
      let stderr = '';
      ffmpeg.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', () => resolve(parseFfmpegDuration(stderr)));
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchAudioBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function backfillCollection(collectionName) {
  const snapshot = await db.collection(collectionName).where('mediaType', '==', 'audio').get();
  let scanned = 0;
  let candidates = 0;
  let updated = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data();
    if (hasValidDuration(data.mediaDurationSeconds)) continue;

    candidates += 1;
    const mediaURL = data.mediaURL || data.mediaOriginalURL || data.videoURL;
    if (typeof mediaURL !== 'string' || !mediaURL) {
      console.warn(`[${collectionName}/${doc.id}] missing media URL`);
      failed += 1;
      continue;
    }

    try {
      const buffer = await fetchAudioBuffer(mediaURL);
      const durationSeconds = await detectAudioDurationSeconds(
        buffer,
        String(data.mediaContentType || data.mediaOriginalContentType || ''),
      );

      if (!hasValidDuration(durationSeconds)) {
        console.warn(`[${collectionName}/${doc.id}] could not detect duration`);
        failed += 1;
        continue;
      }

      console.log(
        `${WRITE ? 'Updating' : 'Would update'} ${collectionName}/${doc.id}: ${durationSeconds}s`,
      );

      if (WRITE) {
        await doc.ref.update({
          mediaDurationSeconds: durationSeconds,
          audioDurationBackfilledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      updated += 1;
    } catch (error) {
      console.warn(
        `[${collectionName}/${doc.id}] ${error instanceof Error ? error.message : String(error)}`,
      );
      failed += 1;
    }
  }

  return { collectionName, scanned, candidates, updated, failed };
}

async function main() {
  console.log(
    WRITE
      ? 'Backfilling audio durations and writing updates...'
      : 'Dry run. Pass --write to update Firestore.',
  );

  const results = [];
  for (const collectionName of COLLECTIONS) {
    results.push(await backfillCollection(collectionName));
  }

  console.table(results);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
