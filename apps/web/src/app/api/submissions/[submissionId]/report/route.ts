import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@batalha/firebase/src/admin';
import { getErrorResponse } from '../../../../../server/api-errors';
import { requireDecodedToken } from '../../../../../server/auth';
import { readJsonObject } from '../../../../../server/request';
import { reportSubmission } from '../../../../../server/submission-service';
import type { SubmissionReportReason } from '@batalha/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  try {
    const decodedToken = await requireDecodedToken(req);
    const body = await readJsonObject(req);
    const result = await reportSubmission(getAdminFirestore(), {
      submissionId: params.submissionId,
      reporterId: decodedToken.uid,
      reason: body.reason as SubmissionReportReason,
      description: typeof body.description === 'string' ? body.description : '',
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = getErrorResponse(error, 'Erro ao denunciar envio.');
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
