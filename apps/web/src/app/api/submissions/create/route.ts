import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorageBucket } from '@batalha/firebase/src/admin';
import { competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import {
  detectAudioDurationSeconds,
  getResolvedAudioDurationSeconds,
} from '../../../../server/audio-transcoding';
import { uploadBattleSubmissionAudio } from '../../../../server/daily-highlight-audio-service';
import { createSubmission } from '../../../../server/submission-service';

export async function POST(req: NextRequest) {
  const bucket = getAdminStorageBucket();
  let uploadedAudioPaths: string[] = [];

  try {
    const decodedToken = await requireDecodedToken(req);
    const formData = await req.formData();
    const file = formData.get('audio');
    const categoryResult = competitionCategorySchema.safeParse(formData.get('category'));
    const clientDurationSeconds = Number(formData.get('durationSeconds') ?? 0);

    if (!categoryResult.success) {
      throw new ApiError(400, 'Categoria invalida');
    }
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
    const upload = await uploadBattleSubmissionAudio({
      bucket,
      userId: decodedToken.uid,
      battleId: typeof formData.get('battleId') === 'string' ? String(formData.get('battleId')) : '',
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

    const result = await createSubmission(getAdminFirestore(), {
      battleId: typeof formData.get('battleId') === 'string' ? String(formData.get('battleId')) : '',
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
      category: categoryResult.data,
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
      console.error('Submission creation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar assobio. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
