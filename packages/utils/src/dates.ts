export interface TimestampLike {
  seconds: number;
  nanoseconds?: number;
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const timestamp = value as TimestampLike;
    return new Date(timestamp.seconds * 1000);
  }

  return null;
}
