import { Request, Response } from 'express';
import { createPostSchema, generateVariantsSchema } from '../validation/postSchemas.js';
import { postRepository } from '../services/postRepository.js';
import { fetchAndExtractUrlContent, UrlIngestionError } from '../services/urlIngestionService.js';
import { variantGeneratorService } from '../services/variantGenerator.js';

export class PostController {
  public createPost = async (req: Request, res: Response): Promise<void> => {
    const parseResult = createPostSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    const data = parseResult.data;

    try {
      if (data.sourceType === 'url') {
        const ingested = await fetchAndExtractUrlContent(data.url!);
        const post = await postRepository.createPost({
          sourceType: 'url',
          sourceUrl: data.url,
          sourceContent: ingested.content,
          title: data.title || ingested.title
        });

        res.status(201).json({
          id: post.id,
          sourceType: post.source_type,
          sourceUrl: post.source_url,
          title: post.title,
          sourceContent: post.source_content,
          createdAt: post.created_at
        });
        return;
      }

      if (data.sourceType === 'markdown') {
        const post = await postRepository.createPost({
          sourceType: 'markdown',
          sourceContent: data.content!,
          title: data.title || null
        });

        res.status(201).json({
          id: post.id,
          sourceType: post.source_type,
          sourceUrl: null,
          title: post.title,
          sourceContent: post.source_content,
          createdAt: post.created_at
        });
        return;
      }
    } catch (err: unknown) {
      if (err instanceof UrlIngestionError) {
        res.status(err.statusCode).json({
          error: {
            code: 'INGESTION_ERROR',
            message: err.message
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing post ingestion.'
        }
      });
    }
  };

  public getPostById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const post = await postRepository.getPostById(id);
    if (!post) {
      res.status(404).json({
        error: {
          code: 'POST_NOT_FOUND',
          message: `No post found with ID: ${id}`
        }
      });
      return;
    }

    res.status(200).json({
      id: post.id,
      sourceType: post.source_type,
      sourceUrl: post.source_url,
      title: post.title,
      sourceContent: post.source_content,
      createdAt: post.created_at,
      updatedAt: post.updated_at
    });
  };

  public generateVariants = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const post = await postRepository.getPostById(id);
    if (!post) {
      res.status(404).json({
        error: {
          code: 'POST_NOT_FOUND',
          message: `Cannot generate variants. No post found with ID: ${id}`
        }
      });
      return;
    }

    const parseResult = generateVariantsSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid variant generation parameters.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    const variants = await variantGeneratorService.generateVariantsForPost(post, parseResult.data);

    res.status(201).json({
      postId: post.id,
      variants: variants.map((v) => ({
        id: v.id,
        postId: v.post_id,
        platform: v.platform,
        content: v.content,
        status: v.status,
        validationInfo: v.validation_info,
        createdAt: v.created_at
      }))
    });
  };

  public getVariantById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const variant = await postRepository.getVariantById(id);
    if (!variant) {
      res.status(404).json({
        error: {
          code: 'VARIANT_NOT_FOUND',
          message: `No variant found with ID: ${id}`
        }
      });
      return;
    }

    res.status(200).json({
      id: variant.id,
      postId: variant.post_id,
      platform: variant.platform,
      content: variant.content,
      status: variant.status,
      validationInfo: variant.validation_info,
      createdAt: variant.created_at,
      updatedAt: variant.updated_at
    });
  };
}

export const postController = new PostController();
