import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { getAdminReferralAnalytics } from '../../../../../server/admin-analytics-service';

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
    const result = await getAdminReferralAnalytics({
      db: getAdminFirestore(),
      adminUserId: decodedToken.uid,
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Admin analytics referral error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao carregar analytics');
    return NextResponse.json(
      { error: response.error },
      { status: response.status, headers: corsHeaders },
    );
  }
}
