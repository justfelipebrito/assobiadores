import { z } from 'zod';

// Firestore Timestamp can be a Date, Firestore Timestamp object, or server sentinel
export const timestampSchema = z.any();
export type FirestoreTimestamp = Date | { seconds: number; nanoseconds: number };
