import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { brazilStateSchema, competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';
import { generateQualifierBracket } from '../../../../../server/qualifier-generation-service';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const regionResult = brazilStateSchema.safeParse(body.region);
    const categoryResult = competitionCategorySchema.safeParse(body.category);

    if (!regionResult.success) throw new ApiError(400, 'Estado e obrigatorio');
    if (!categoryResult.success) throw new ApiError(400, 'Categoria e obrigatoria');

    const result = await generateQualifierBracket(getAdminFirestore(), {
      adminUserId: decodedToken.uid,
      region: regionResult.data,
      category: categoryResult.data,
    });

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Qualifier bracket generation error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao gerar chave da classificatoria');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: CORS_HEADERS },
    );
  }
}
