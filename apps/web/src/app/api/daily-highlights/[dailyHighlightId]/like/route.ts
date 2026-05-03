import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { ApiError, getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { likeDailyHighlight } from '../../../../../server/daily-highlight-service';

export async function POST(req: NextRequest, { params }: { params: { dailyHighlightId: string } }) {
  try {
    const decodedToken = await requireDecodedToken(req);

    const result = await likeDailyHighlight(getAdminFirestore(), {
      dailyHighlightId: params.dailyHighlightId,
      userId: decodedToken.uid,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      console.error('Daily highlight like error:', error);
    }
    const response = getErrorResponse(error, 'Erro ao curtir destaque. Tente novamente.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
