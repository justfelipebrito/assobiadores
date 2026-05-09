const HIGH_QUALITY_AUDIO_BITS_PER_SECOND = 128_000;

export const AUDIO_RECORDING_TIMESLICE_MS = 1_000;

type MimeSupport = (mimeType: string) => boolean;

function isAppleBrowser(userAgent = '') {
  const isAppleDevice = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS/.test(userAgent);
  return isAppleDevice || isSafari;
}

export function getSupportedAudioRecorderMimeType({
  isTypeSupported,
  userAgent,
}: {
  isTypeSupported: MimeSupport;
  userAgent?: string;
}) {
  const appleFirstCandidates = [
    'audio/mp4',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  const defaultCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ];
  const candidates = isAppleBrowser(userAgent) ? appleFirstCandidates : defaultCandidates;
  return candidates.find((candidate) => isTypeSupported(candidate)) ?? '';
}

export function getAudioRecorderOptions({
  isTypeSupported,
  userAgent,
}: {
  isTypeSupported: MimeSupport;
  userAgent?: string;
}): MediaRecorderOptions {
  const mimeType = getSupportedAudioRecorderMimeType({ isTypeSupported, userAgent });
  return mimeType
    ? { mimeType, audioBitsPerSecond: HIGH_QUALITY_AUDIO_BITS_PER_SECOND }
    : { audioBitsPerSecond: HIGH_QUALITY_AUDIO_BITS_PER_SECOND };
}

export function createAudioMediaRecorder({
  stream,
  mediaRecorder,
  isTypeSupported,
  userAgent,
}: {
  stream: MediaStream;
  mediaRecorder: typeof MediaRecorder;
  isTypeSupported: MimeSupport;
  userAgent?: string;
}) {
  const options = getAudioRecorderOptions({ isTypeSupported, userAgent });
  try {
    return new mediaRecorder(stream, options);
  } catch {
    return new mediaRecorder(stream);
  }
}

export function getAudioCaptureConstraints(): MediaStreamConstraints {
  return {
    audio: {
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48_000 },
      sampleSize: { ideal: 16 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}

export async function getRecordingAudioStream(mediaDevices: MediaDevices) {
  try {
    return await mediaDevices.getUserMedia(getAudioCaptureConstraints());
  } catch {
    return mediaDevices.getUserMedia({ audio: true });
  }
}

export function getRecordedAudioFileName(contentType: string) {
  if (contentType.includes('mp4')) return 'assobio.m4a';
  if (contentType.includes('aac')) return 'assobio.aac';
  if (contentType.includes('ogg')) return 'assobio.ogg';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'assobio.mp3';
  return 'assobio.webm';
}

export function createRecordedAudioBlob(chunks: Blob[], mimeType?: string) {
  return new Blob(chunks, { type: mimeType || 'audio/webm' });
}
