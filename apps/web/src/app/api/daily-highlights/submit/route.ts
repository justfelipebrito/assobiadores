import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import { createDailyHighlight } from '../../../../server/daily-highlight-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
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
