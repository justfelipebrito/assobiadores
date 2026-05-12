import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';
import { bootstrapUserProfile } from '../../../../server/user-bootstrap-service';
import { parseReferralAttributionInput } from '../../../../server/referral-service';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const result = await bootstrapUserProfile(getAdminFirestore(), {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName:
        typeof body.displayName === 'string'
          ? body.displayName
          : typeof decodedToken.name === 'string'
            ? decodedToken.name
            : null,
      photoURL:
        typeof body.photoURL === 'string'
          ? body.photoURL
          : typeof decodedToken.picture === 'string'
            ? decodedToken.picture
            : null,
      referralAttribution: parseReferralAttributionInput(body.referralAttribution),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Bootstrap user error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao preparar perfil');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
