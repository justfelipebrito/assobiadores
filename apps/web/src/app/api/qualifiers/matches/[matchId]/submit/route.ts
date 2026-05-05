import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorageBucket } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../../server/auth';
import { uploadQualifierSubmissionAudio } from '../../../../../../server/daily-highlight-audio-service';
import { createQualifierSubmission } from '../../../../../../server/qualifier-submission-service';

interface RouteContext {
  params: { matchId: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const bucket = getAdminStorageBucket();
  let uploadedAudioPath: string | null = null;

  try {
    const decodedToken = await requireDecodedToken(req);
    const formData = await req.formData();
    const file = formData.get('audio');
    const durationSeconds = Number(formData.get('durationSeconds') ?? 0);

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      throw new ApiError(400, 'Grave um audio antes de enviar');
    }

    const audioContentType = 'type' in file ? String(file.type) : '';
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadQualifierSubmissionAudio({
      bucket,
      userId: decodedToken.uid,
      matchId: params.matchId,
      buffer,
      contentType: audioContentType,
    });
    uploadedAudioPath = upload.audioPath;

    const result = await createQualifierSubmission(getAdminFirestore(), {
      matchId: params.matchId,
      userId: decodedToken.uid,
      audioURL: upload.audioURL,
      audioPath: upload.audioPath,
      contentType: audioContentType,
      sizeBytes: buffer.length,
      durationSeconds,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (uploadedAudioPath) {
      await bucket
        .file(uploadedAudioPath)
        .delete()
        .catch(() => undefined);
    }
    if (!(error instanceof ApiError)) {
      console.error('Qualifier submission error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar assobio. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
