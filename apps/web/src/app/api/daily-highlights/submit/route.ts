import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorageBucket } from '@batalha/firebase/src/admin';
import { competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import {
  createDailyHighlight,
  createDailyHighlightFromAudio,
} from '../../../../server/daily-highlight-service';
import { uploadDailyHighlightAudio } from '../../../../server/daily-highlight-audio-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio');
      const categoryResult = competitionCategorySchema.safeParse(formData.get('category'));
      const durationSeconds = Number(formData.get('durationSeconds') ?? 0);

      if (!categoryResult.success) {
        throw new ApiError(400, 'Categoria invalida');
      }
      if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        throw new ApiError(400, 'Grave um audio antes de enviar');
      }

      const audioContentType = 'type' in file ? String(file.type) : '';
      const buffer = Buffer.from(await file.arrayBuffer());
      const bucket = getAdminStorageBucket();
      const upload = await uploadDailyHighlightAudio({
        bucket,
        userId: decodedToken.uid,
        buffer,
        contentType: audioContentType,
        category: categoryResult.data,
      });

      let result;
      try {
        result = await createDailyHighlightFromAudio(getAdminFirestore(), {
          userId: decodedToken.uid,
          audioURL: upload.audioURL,
          audioPath: upload.audioPath,
          contentType: audioContentType,
          sizeBytes: buffer.length,
          durationSeconds,
          category: categoryResult.data,
        });
      } catch (error) {
        await bucket
          .file(upload.audioPath)
          .delete()
          .catch(() => undefined);
        throw error;
      }

      return NextResponse.json(result);
    }

    const body = await readJsonObject(req);

    const result = await createDailyHighlight(getAdminFirestore(), {
      userId: decodedToken.uid,
      videoURL: typeof body.videoURL === 'string' ? body.videoURL : '',
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Daily highlight submit error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar destaque. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
