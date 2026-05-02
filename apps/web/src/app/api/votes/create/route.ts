import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import { createVote } from '../../../../server/vote-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);

    const result = await createVote(getAdminFirestore(), {
      battleId: typeof body.battleId === 'string' ? body.battleId : '',
      submissionId: typeof body.submissionId === 'string' ? body.submissionId : '',
      voterId: decodedToken.uid,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Vote creation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao votar. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
