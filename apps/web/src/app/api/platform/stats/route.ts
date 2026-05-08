import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { getErrorResponse } from '../../../../server/api-errors';
import { getPlatformStats } from '../../../../server/platform-stats-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getPlatformStats(getAdminFirestore());

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const response = getErrorResponse(error, 'Nao foi possivel carregar os numeros da plataforma');

    return NextResponse.json(
      { error: response.error },
      {
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }
}
