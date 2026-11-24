import { z } from 'zod';

import { SEVERITY_ORDER } from '../constants/severity';

export const updateSettingsSchema = z.object({
  ollamaUrl: z.string().trim().max(400).optional(),
  model: z.string().trim().max(200).optional(),
  aiReview: z.boolean().optional(),
  aiMaxFiles: z.number().int().min(1).max(50).optional(),
  minSeverity: z.enum(SEVERITY_ORDER).optional(),
  globalIgnoreGlobs: z
    .array(z.string().trim().min(1).max(200))
    .max(300)
    .transform((values) => [...new Set(values)])
    .optional()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
