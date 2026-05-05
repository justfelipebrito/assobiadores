import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';
import { removeSubmission } from '../../../../../server/submission-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const action = body.action ?? body.status;

    if (action !== 'remove' && action !== 'removed') {
      throw new ApiError(400, 'acao invalida');
    }

    const result = await removeSubmission(getAdminFirestore(), {
      submissionId: params.submissionId,
      moderatorId: decodedToken.uid,
      moderationNote: typeof body.moderationNote === 'string' ? body.moderationNote : null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Submission moderation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao moderar submissao.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
