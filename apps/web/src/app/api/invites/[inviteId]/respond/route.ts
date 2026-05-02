import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { respondToInvite } from '../../../../../server/invite-service';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';

export async function POST(
  req: NextRequest,
  { params }: { params: { inviteId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const { accept } = await readJsonObject(req);

    const result = await respondToInvite(getAdminFirestore(), {
      inviteId: params.inviteId,
      userId: decodedToken.uid,
      accept: accept === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Respond invite error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao responder convite.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
