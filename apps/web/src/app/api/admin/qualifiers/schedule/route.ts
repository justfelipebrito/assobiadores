import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { brazilStateSchema, competitionCategorySchema } from '@batalha/types';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';
import {
  updateAllQualifierSchedules,
  updateQualifierSchedule,
} from '../../../../../server/qualifier-schedule-service';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PATCH, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function parseDate(value: unknown, message: string) {
  if (typeof value !== 'string') throw new ApiError(400, message);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, message);
  return date;
}

export async function PATCH(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const scheduleDates = {
      registrationDeadline: parseDate(body.registrationDeadline, 'Fim das inscricoes invalido'),
      bracketStart: parseDate(body.bracketStart, 'Inicio dos envios invalido'),
      bracketEnd: parseDate(body.bracketEnd, 'Fim dos envios invalido'),
    };

    const result =
      body.scope === 'all'
        ? await updateAllQualifierSchedules(getAdminFirestore(), {
            adminUserId: decodedToken.uid,
            ...scheduleDates,
          })
        : await updateOneQualifierSchedule(body, decodedToken.uid, scheduleDates);

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Qualifier schedule update error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao atualizar datas da classificatoria');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: CORS_HEADERS },
    );
  }
}

async function updateOneQualifierSchedule(
  body: Record<string, unknown>,
  adminUserId: string,
  scheduleDates: {
    registrationDeadline: Date;
    bracketStart: Date;
    bracketEnd: Date;
  },
) {
  const regionResult = brazilStateSchema.safeParse(body.region);
  const categoryResult = competitionCategorySchema.safeParse(body.category);

  if (!regionResult.success) throw new ApiError(400, 'Estado e obrigatorio');
  if (!categoryResult.success) throw new ApiError(400, 'Categoria e obrigatoria');

  return updateQualifierSchedule(getAdminFirestore(), {
    adminUserId,
    region: regionResult.data,
    category: categoryResult.data,
    ...scheduleDates,
  });
}
