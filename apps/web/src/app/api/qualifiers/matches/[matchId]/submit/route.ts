import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorageBucket } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../../server/auth';
import {
  detectAudioDurationSeconds,
  getResolvedAudioDurationSeconds,
} from '../../../../../../server/audio-transcoding';
import { uploadQualifierSubmissionAudio } from '../../../../../../server/daily-highlight-audio-service';
import { createQualifierSubmission } from '../../../../../../server/qualifier-submission-service';

interface RouteContext {
  params: { matchId: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const bucket = getAdminStorageBucket();
  let uploadedAudioPaths: string[] = [];

  try {
    const decodedToken = await requireDecodedToken(req);
    const formData = await req.formData();
    const file = formData.get('audio');
    const clientDurationSeconds = Number(formData.get('durationSeconds') ?? 0);

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      throw new ApiError(400, 'Grave um audio antes de enviar');
    }

    const audioContentType = 'type' in file ? String(file.type) : '';
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedDurationSeconds = await detectAudioDurationSeconds(
      buffer,
      audioContentType,
    ).catch((error) => {
      console.warn('Audio duration probe failed; using client duration.', error);
      return null;
    });
    const durationSeconds = getResolvedAudioDurationSeconds({
      detectedDurationSeconds,
      clientDurationSeconds,
    });
    const upload = await uploadQualifierSubmissionAudio({
      bucket,
      userId: decodedToken.uid,
      matchId: params.matchId,
      buffer,
      contentType: audioContentType,
    });
    uploadedAudioPaths = Array.from(
      new Set(
        [upload.audioPath, upload.originalAudioPath].filter((path): path is string =>
          Boolean(path),
        ),
      ),
    );

    const result = await createQualifierSubmission(getAdminFirestore(), {
      matchId: params.matchId,
      userId: decodedToken.uid,
      audioURL: upload.audioURL,
      audioPath: upload.audioPath,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
      originalAudioURL: upload.originalAudioURL,
      originalAudioPath: upload.originalAudioPath,
      originalContentType: upload.originalContentType,
      originalSizeBytes: upload.originalSizeBytes,
      durationSeconds,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (uploadedAudioPaths.length > 0) {
      await Promise.all(
        uploadedAudioPaths.map((path) =>
          bucket
            .file(path)
            .delete()
            .catch(() => undefined),
        ),
      );
    }
    if (!(error instanceof ApiError)) {
      console.error('Qualifier submission error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar assobio. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
