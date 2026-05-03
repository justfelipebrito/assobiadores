import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import { updateUserProfile } from '../../../../server/profile-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const result = await updateUserProfile(getAdminFirestore(), decodedToken.uid, body);

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Update profile error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao atualizar perfil');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
