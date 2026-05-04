import { z } from 'zod';
import { timestampSchema } from './common';

export const paymentStatusSchema = z.enum(['pending', 'approved', 'rejected', 'refunded']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentTargetTypeSchema = z.enum(['battle_entry', 'qualifier_registration']);
export type PaymentTargetType = z.infer<typeof paymentTargetTypeSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  provider: z.enum(['mercado_pago_payments', 'mercado_pago_orders']).default('mercado_pago_orders'),
  externalId: z.string(),
  externalPaymentId: z.string().nullable().default(null),
  userId: z.string(),
  targetType: paymentTargetTypeSchema.default('battle_entry'),
  targetId: z.string(),
  battleId: z.string().nullable().default(null),
  entryId: z.string().nullable().default(null),
  qualifierRegistrationId: z.string().nullable().default(null),
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
