import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../../server/auth';
import { readJsonObject } from '../../../../../../server/request';
import { createQualifierVote } from '../../../../../../server/qualifier-vote-service';

interface RouteContext {
  params: { matchId: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const result = await createQualifierVote(getAdminFirestore(), {
      matchId: params.matchId,
      submissionId: typeof body.submissionId === 'string' ? body.submissionId : '',
      voterId: decodedToken.uid,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Qualifier vote error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao registrar voto. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
