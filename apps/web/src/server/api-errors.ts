export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getErrorResponse(error: unknown, fallbackMessage: string, fallbackStatus = 500) {
  if (error instanceof ApiError) {
    return { error: error.message, status: error.status };
  }

  return { error: fallbackMessage, status: fallbackStatus };
}
