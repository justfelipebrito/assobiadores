import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { brazilStateSchema, competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';
import { finalizeQualifierRound } from '../../../../../server/qualifier-finalization-service';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const eventId = typeof body.eventId === 'string' && body.eventId.trim() ? body.eventId : undefined;
    const regionResult = brazilStateSchema.safeParse(body.region);
    const categoryResult = competitionCategorySchema.safeParse(body.category);
    if (!eventId && !regionResult.success) throw new ApiError(400, 'Estado e obrigatorio');
    if (!eventId && !categoryResult.success) throw new ApiError(400, 'Categoria invalida');
    const roundNumber =
      typeof body.roundNumber === 'number' && Number.isFinite(body.roundNumber)
        ? Math.floor(body.roundNumber)
        : undefined;

    const result = await finalizeQualifierRound(getAdminFirestore(), {
      adminUserId: decodedToken.uid,
      region: regionResult.success ? regionResult.data : undefined,
      category: categoryResult.success ? categoryResult.data : undefined,
      eventId,
      roundNumber,
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Qualifier round finalization error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao finalizar rodada.');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: corsHeaders },
    );
  }
}
