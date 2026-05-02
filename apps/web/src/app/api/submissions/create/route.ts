import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import { createSubmission } from '../../../../server/submission-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);

    const result = await createSubmission(getAdminFirestore(), {
      battleId: typeof body.battleId === 'string' ? body.battleId : '',
      userId: decodedToken.uid,
      videoURL: typeof body.videoURL === 'string' ? body.videoURL : '',
      title: typeof body.title === 'string' ? body.title : '',
      description: typeof body.description === 'string' ? body.description : '',
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Submission creation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar video. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
