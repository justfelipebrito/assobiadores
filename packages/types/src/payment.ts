import { z } from 'zod';
import { timestampSchema } from './common';

export const paymentStatusSchema = z.enum(['pending', 'approved', 'rejected', 'refunded']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  userId: z.string(),
  battleId: z.string(),
  entryId: z.string(),
  amount: z.number().int().positive(),
  status: paymentStatusSchema.default('pending'),
  pixQrCode: z.string(),
  pixCopiaECola: z.string(),
  idempotencyKey: z.string(),
  webhookReceivedAt: timestampSchema.nullable().default(null),
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Payment = z.infer<typeof paymentSchema>;
