import { z } from 'zod';

export const createPostSchema = z.object({
  sourceType: z.enum(['url', 'markdown']),
  url: z.string().url().optional(),
  content: z.string().optional(),
  title: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.sourceType === 'url') {
    if (!data.url || data.url.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid "url" parameter is required when sourceType is "url".',
        path: ['url']
      });
    }
    if (data.content !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot provide both "url" and "content" simultaneously.',
        path: ['content']
      });
    }
  }

  if (data.sourceType === 'markdown') {
    if (!data.content || data.content.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Non-empty "content" parameter is required when sourceType is "markdown".',
        path: ['content']
      });
    }
    if (data.url !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot provide both "url" and "content" simultaneously.',
        path: ['url']
      });
    }
  }
});

export const generateVariantsSchema = z.object({
  platforms: z.array(z.enum(['discord', 'mock_x', 'mock_linkedin'])).optional(),
  customContentOverride: z.record(z.string()).optional()
});
