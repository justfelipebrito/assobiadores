import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { finalizeBattle } from '../../../../../server/battle-finalization-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { battleId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const result = await finalizeBattle(getAdminFirestore(), {
      actorUserId: decodedToken.uid,
      battleId: params.battleId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Creator battle finalization error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao finalizar batalha.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
