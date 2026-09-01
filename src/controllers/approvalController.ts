import { Request, Response } from 'express';
import { approvalService } from '../services/approvalService.js';
import { rejectVariantSchema, editVariantSchema, scheduleVariantSchema } from '../validation/approvalSchemas.js';
import { InvalidStateTransitionError } from '../models/types.js';

export class ApprovalController {
  public approveVariant = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    try {
      const updated = await approvalService.approveVariant(id);
      res.status(200).json({
        id: updated.id,
        postId: updated.post_id,
        platform: updated.platform,
        status: updated.status,
        validationInfo: updated.validation_info,
        updatedAt: updated.updated_at
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public rejectVariant = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parseResult = rejectVariantSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rejection payload.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    try {
      const updated = await approvalService.rejectVariant(id, parseResult.data.reason);
      res.status(200).json({
        id: updated.id,
        postId: updated.post_id,
        platform: updated.platform,
        status: updated.status,
        rejectionReason: updated.rejection_reason,
        updatedAt: updated.updated_at
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public editVariant = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parseResult = editVariantSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid edit payload.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    try {
      const updated = await approvalService.editVariant(id, parseResult.data.content);
      res.status(200).json({
        id: updated.id,
        postId: updated.post_id,
        platform: updated.platform,
        content: updated.content,
        status: updated.status,
        validationInfo: updated.validation_info,
        updatedAt: updated.updated_at
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public scheduleVariant = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const parseResult = scheduleVariantSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule payload.',
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    try {
      const slot = await approvalService.scheduleVariant(id, parseResult.data.scheduledAt);
      res.status(201).json({
        id: slot.id,
        variantId: slot.variant_id,
        scheduledAt: slot.scheduled_at,
        status: slot.status,
        createdAt: slot.created_at
      });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  public getVariantHistory = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    try {
      const history = await approvalService.getVariantAuditHistory(id);
      res.status(200).json({
        variantId: id,
        history: history.map((h) => ({
          id: h.id,
          previousStatus: h.previous_status,
          newStatus: h.new_status,
          reason: h.reason,
          createdAt: h.created_at
        }))
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
          code: 'INVALID_STATE_TRANSITION',
          message: err.message
        }
      });
      return;
    }

    if (err.statusCode === 422) {
      res.status(422).json({
        error: {
          code: 'CONSTRAINT_VALIDATION_FAILED',
          message: err.message,
          details: err.details
        }
      });
      return;
    }

    if (err.statusCode === 400) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: err.message
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  }
}

export const approvalController = new ApprovalController();
