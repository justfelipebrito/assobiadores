import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { listAdminUserPrivateSummaries } from '../../../../../server/admin-user-private-service';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const result = await listAdminUserPrivateSummaries(getAdminFirestore(), {
      adminUserId: decodedToken.uid,
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Admin private user profile list error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao carregar dados privados de usuarios');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: corsHeaders },
    );
  }
}
