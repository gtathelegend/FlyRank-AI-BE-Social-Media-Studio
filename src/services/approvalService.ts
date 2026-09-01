import {
  Variant,
  Slot,
  VariantAuditLog,
  InvalidStateTransitionError,
  assertVariantApprovedForScheduling
} from '../models/types.js';
import { postRepository } from './postRepository.js';
import { validateVariantContent } from './constraintValidator.js';

export class ApprovalService {
  public async approveVariant(variantId: string): Promise<Variant> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (variant.status !== 'draft') {
      throw new InvalidStateTransitionError(
        `Cannot approve variant in '${variant.status}' status. Only 'draft' variants can be approved.`,
        409
      );
    }

    const validationInfo = validateVariantContent(variant.content, variant.platform);
    if (!validationInfo.isValid) {
      const err = new Error(`Variant failed platform constraint validation: ${validationInfo.errors.join('; ')}`);
      (err as any).statusCode = 422;
      (err as any).details = validationInfo;
      throw err;
    }

    const updated = await postRepository.updateVariant(variantId, {
      status: 'approved',
      validation_info: validationInfo
    });

    await postRepository.createAuditLog(variantId, 'draft', 'approved', 'Approved by human reviewer');
    return updated;
  }

  public async rejectVariant(variantId: string, reason?: string | null): Promise<Variant> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (variant.status !== 'draft') {
      throw new InvalidStateTransitionError(
        `Cannot reject variant in '${variant.status}' status. Only 'draft' variants can be rejected.`,
        409
      );
    }

    const updated = await postRepository.updateVariant(variantId, {
      status: 'rejected',
      rejection_reason: reason || null
    });

    await postRepository.createAuditLog(variantId, 'draft', 'rejected', reason || 'Rejected by human reviewer');
    return updated;
  }

  public async editVariant(variantId: string, newContent: string): Promise<Variant> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (variant.status === 'published') {
      throw new InvalidStateTransitionError('Cannot edit a variant that has already been published.', 409);
    }

    const validationInfo = validateVariantContent(newContent, variant.platform);
    if (!validationInfo.isValid) {
      const err = new Error(`Edited content failed constraint validation: ${validationInfo.errors.join('; ')}`);
      (err as any).statusCode = 422;
      (err as any).details = validationInfo;
      throw err;
    }

    const previousStatus = variant.status;
    const updated = await postRepository.updateVariant(variantId, {
      content: newContent,
      status: 'draft', // Editing forces status back to draft for re-review
      validation_info: validationInfo,
      rejection_reason: null
    });

    await postRepository.createAuditLog(
      variantId,
      previousStatus,
      'draft',
      `Content edited. Reset status to draft for re-approval.`
    );

    return updated;
  }

  public async scheduleVariant(variantId: string, scheduledAtInput: string | Date): Promise<Slot> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    // MANDATORY SECURITY/SAFETY GUARD: Only approved variants can enter the scheduling system
    assertVariantApprovedForScheduling(variant);

    const scheduledAt = new Date(scheduledAtInput);
    if (isNaN(scheduledAt.getTime())) {
      const err = new Error('Invalid scheduledAt timestamp provided.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (scheduledAt.getTime() < Date.now()) {
      const err = new Error('scheduledAt timestamp must be in the future.');
      (err as any).statusCode = 400;
      throw err;
    }

    const slot = await postRepository.createSlot(variantId, scheduledAt);
    await postRepository.createAuditLog(variantId, 'approved', 'approved', `Scheduled for ${scheduledAt.toISOString()}`);
    return slot;
  }

  public async getVariantAuditHistory(variantId: string): Promise<VariantAuditLog[]> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    return postRepository.getVariantAuditLogs(variantId);
  }
}

export const approvalService = new ApprovalService();
