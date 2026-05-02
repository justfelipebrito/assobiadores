import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { sendBattleInvite } from '../../../../../server/invite-service';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';

export async function POST(
  req: NextRequest,
  { params }: { params: { battleId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const { username } = await readJsonObject(req);

    const result = await sendBattleInvite(getAdminFirestore(), {
      battleId: params.battleId,
      fromUserId: decodedToken.uid,
      toUsername: typeof username === 'string' ? username : '',
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Send invite error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao enviar convite.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
