import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { createCommunityBattle } from '../../../../server/battle-service';
import { ApiError, getErrorResponse } from '../../../../server/api-errors';
import { requireDecodedToken } from '../../../../server/auth';
import { readJsonObject } from '../../../../server/request';

export async function POST(req: NextRequest) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const db = getAdminFirestore();

    // Fetch creator's plan to enforce free-tier cap
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userPlan: string = userDoc.data()?.plan ?? 'free';

    const body = await readJsonObject(req);
    const result = await createCommunityBattle(db, {
      userId: decodedToken.uid,
      userPlan,
      body,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Create battle error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao criar batalha. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
