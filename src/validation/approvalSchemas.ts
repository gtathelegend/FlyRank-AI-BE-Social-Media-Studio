import { z } from 'zod';

export const rejectVariantSchema = z.object({
  reason: z.string().max(500, 'Rejection reason must not exceed 500 characters').optional()
});

export const editVariantSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty')
});

export const scheduleVariantSchema = z.object({
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO 8601 timestamp' })
});
