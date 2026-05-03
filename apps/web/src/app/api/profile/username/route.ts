import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { checkUsernameAvailability } from '../../../../server/profile-service';

export async function GET(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const username = req.nextUrl.searchParams.get('username') ?? '';
    const result = await checkUsernameAvailability(getAdminFirestore(), username, decodedToken.uid);

    return NextResponse.json(result);
  } catch (error) {
    const response = getErrorResponse(error, 'Erro ao verificar username');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
