import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { createFreeBattleEntry } from '../../../../server/battle-entry-service';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const { battleId } = await readJsonObject(req);

    const result = await createFreeBattleEntry(getAdminFirestore(), {
      battleId: typeof battleId === 'string' ? battleId : '',
      userId: decodedToken.uid,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Free battle entry error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao participar. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
