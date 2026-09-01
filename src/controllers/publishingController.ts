import { Request, Response } from 'express';
import { publishingService } from '../services/publishingService.js';
import { publishVariantSchema } from '../validation/publishingSchemas.js';
import { InvalidStateTransitionError } from '../models/types.js';

export class PublishingController {
  public publishVariant = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parseResult = publishVariantSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid publish request body.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    try {
      const result = await publishingService.publishVariant(
        id,
        parseResult.data.slotId,
        parseResult.data.idempotencyKey
      );

      res.status(200).json({
        attemptId: result.attempt.id,
        variantId: result.variant.id,
        slotId: result.attempt.slot_id,
        status: result.attempt.status,
        isReplay: result.isReplay,
        externalPostId: result.attempt.external_post_id,
        publishedAt: result.attempt.completed_at,
        url: result.url
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public getVariantPublishAttempts = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    try {
      const attempts = await publishingService.getPublishAttemptsForVariant(id);
      res.status(200).json({
        variantId: id,
        attempts: attempts.map((a) => ({
          id: a.id,
          slotId: a.slot_id,
          idempotencyKey: a.idempotency_key,
          status: a.status,
          attemptedAt: a.attempted_at,
          completedAt: a.completed_at,
          externalPostId: a.external_post_id,
          errorInfo: a.error_info
        }))
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public getPublishAttemptById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    try {
      const attempt = await publishingService.getPublishAttemptById(id);
      if (!attempt) {
        res.status(404).json({
          error: {
            code: 'ATTEMPT_NOT_FOUND',
            message: `No publish attempt found with ID: ${id}`
          }
        });
        return;
      }

      res.status(200).json({
        id: attempt.id,
        variantId: attempt.variant_id,
        slotId: attempt.slot_id,
        idempotencyKey: attempt.idempotency_key,
        status: attempt.status,
        attemptedAt: attempt.attempted_at,
        completedAt: attempt.completed_at,
        externalPostId: attempt.external_post_id,
        errorInfo: attempt.error_info
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public getPublishHistory = async (_req: Request, res: Response): Promise<void> => {
    try {
      const history = await publishingService.getPublishHistory();
      res.status(200).json({
        total: history.length,
        history
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  private handleError(res: Response, err: any): void {
    if (err.statusCode === 404) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: err.message
        }
      });
      return;
    }

    if (err instanceof InvalidStateTransitionError || err.statusCode === 409) {
      res.status(409).json({
        error: {
          code: 'UNAPPROVED_VARIANT_PUBLISH_FORBIDDEN',
          message: err.message
        }
      });
      return;
    }

    if (err.statusCode === 502) {
      res.status(502).json({
        error: {
          code: 'PLATFORM_PUBLISH_ERROR',
          message: err.message,
          attempt: err.details
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred during publishing execution.'
      }
    });
  }
}

export const publishingController = new PublishingController();
