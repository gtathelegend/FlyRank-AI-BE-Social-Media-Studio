import { z } from 'zod';

export const createPostSchema = z
  .object({
    sourceType: z.enum(['url', 'markdown']).optional(),
    url: z.string().optional(),
    content: z.string().optional(),
    body: z.string().optional(),
    title: z.string().optional()
  })
  .transform((data) => {
    const rawContent = data.content || data.body;
    const inferredSourceType = data.sourceType || (data.url ? 'url' : 'markdown');
    return {
      ...data,
      content: rawContent,
      sourceType: inferredSourceType
    };
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'url') {
      if (!data.url || data.url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A valid "url" parameter is required when sourceType is "url".',
          path: ['url']
        });
      } else {
        try {
          new URL(data.url);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid URL format.',
            path: ['url']
          });
        }
      }
      if (data.content !== undefined && data.content.trim().length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cannot provide both "url" and "content"/"body" simultaneously.',
          path: ['content']
        });
      }
    }

    if (data.sourceType === 'markdown') {
      if (!data.content || data.content.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Non-empty "content" or "body" parameter is required when sourceType is "markdown".',
          path: ['content']
        });
      }
      if (data.url !== undefined && data.url.trim().length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cannot provide both "url" and "content"/"body" simultaneously.',
          path: ['url']
        });
      }
    }
  });

export const generateVariantsSchema = z.object({
  platforms: z.array(z.enum(['discord', 'mock_x', 'mock_linkedin'])).optional(),
  customContentOverride: z.record(z.string()).optional()
});
