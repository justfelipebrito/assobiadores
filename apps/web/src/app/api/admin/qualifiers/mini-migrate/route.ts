import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { MINI_QUALIFIER_CATEGORY } from '../../../../../lib/qualifier-tracks';
import { migrateQualifierEntriesToMiniKnockout } from '../../../../../server/qualifier-mini-migration-service';
import { readJsonObject } from '../../../../../server/request';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Data invalida');
  }
  return date;
}

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const categoryResult = competitionCategorySchema.safeParse(body.category);

    if (!categoryResult.success) throw new ApiError(400, 'Categoria e obrigatoria');
    if (categoryResult.data !== MINI_QUALIFIER_CATEGORY) {
      throw new ApiError(400, 'Mini Classificatoria esta disponivel apenas para Freestyle.');
    }

    const result = await migrateQualifierEntriesToMiniKnockout(getAdminFirestore(), {
      adminUserId: decodedToken.uid,
      category: categoryResult.data,
      registrationDeadline: parseDate(body.registrationDeadline),
      bracketStart: parseDate(body.bracketStart),
      bracketEnd: parseDate(body.bracketEnd),
    });

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Mini qualifier migration error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao criar Mini Classificatoria');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: CORS_HEADERS },
    );
  }
}
