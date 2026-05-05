import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@batalha/firebase/src/admin';
import { ApiError } from './api-errors';

const INVALID_SESSION_AUTH_CODES = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-argument',
  'auth/invalid-id-token',
]);

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  return String((error as { code?: unknown }).code);
}

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

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    if (INVALID_SESSION_AUTH_CODES.has(getErrorCode(error) ?? '')) {
      throw new ApiError(401, 'Sessao expirada. Entre novamente.');
    }

    throw error;
  }
}
