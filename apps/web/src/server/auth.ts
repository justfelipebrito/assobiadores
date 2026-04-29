import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@batalha/firebase/src/admin';
import { ApiError } from './api-errors';

export async function requireDecodedToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Nao autorizado');
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    throw new ApiError(401, 'Nao autorizado');
  }

  return getAdminAuth().verifyIdToken(token);
}
