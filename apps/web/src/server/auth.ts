import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@batalha/firebase/src/admin';
import { ApiError } from './api-errors';

export async function requireDecodedToken(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  }

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
