import type { NextRequest } from 'next/server';
import { ApiError } from './api-errors';

export async function readJsonObject(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'JSON invalido');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Corpo da requisicao invalido');
  }

  return body as Record<string, unknown>;
}
