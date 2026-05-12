import { z } from 'zod';
import { timestampSchema } from './common';

export const homepageSettingsSchema = z.object({
  id: z.string().optional(),
  dailyHighlightBannerEnabled: z.boolean().default(false),
  dailyHighlightBannerText: z.string().max(160).optional(),
  dailyHighlightBannerEndDayKey: z.string().optional(),
  updatedAt: timestampSchema.optional(),
  updatedBy: z.string().optional(),
});

export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;
