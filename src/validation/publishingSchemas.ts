import { z } from 'zod';

export const publishVariantSchema = z.object({
  slotId: z.string().uuid({ message: 'slotId must be a valid UUID' }).optional(),
  idempotencyKey: z.string().max(255).optional()
});
