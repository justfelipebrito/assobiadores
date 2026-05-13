import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../../server/auth';
import { readJsonObject } from '../../../../../../server/request';
import { updateUserProfileAsAdmin } from '../../../../../../server/admin-user-service';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const result = await updateUserProfileAsAdmin(getAdminFirestore(), {
      adminUserId: decodedToken.uid,
      targetUserId: params.userId,
      body,
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Admin user profile update error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao atualizar usuario');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: corsHeaders },
    );
  }
}
