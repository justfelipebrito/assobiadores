import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorageBucket } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { uploadUserAvatar } from '../../../../server/avatar-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      throw new ApiError(400, 'Envie uma imagem');
    }

    const contentType = 'type' in file ? String(file.type) : '';
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadUserAvatar({
      db: getAdminFirestore(),
      bucket: getAdminStorageBucket(),
      userId: decodedToken.uid,
      buffer,
      contentType,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Upload profile photo error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar foto');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
