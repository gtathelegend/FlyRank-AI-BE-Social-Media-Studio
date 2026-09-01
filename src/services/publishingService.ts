import {
  Variant,
  PublishAttempt,
  InvalidStateTransitionError,
  assertVariantApprovedForScheduling
} from '../models/types.js';
import { postRepository } from './postRepository.js';
import { publisherRegistry } from '../adapters/PublisherRegistry.js';
import { PublishInput, PublishResult } from '../adapters/SocialPublisher.js';

export interface PublishVariantResponse {
  attempt: PublishAttempt;
  isReplay: boolean;
  variant: Variant;
  url?: string | null;
}

export class PublishingService {
  public async publishVariant(
    variantId: string,
    slotIdInput?: string,
    customIdempotencyKey?: string
  ): Promise<PublishVariantResponse> {
    // 1. Load variant from database
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 2. Verify associated post exists
    const post = await postRepository.getPostById(variant.post_id);
    if (!post) {
      const err = new Error(`Associated post not found with ID: ${variant.post_id}`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 3. Resolve or create slot context
    let slotId: string;
    if (slotIdInput) {
      const slot = await postRepository.getSlotById(slotIdInput);
      if (!slot) {
        const err = new Error(`Scheduled slot not found with ID: ${slotIdInput}`);
        (err as any).statusCode = 404;
        throw err;
      }
      slotId = slot.id;
    } else {
      const existingSlots = await postRepository.getSlotsByVariantId(variantId);
      if (existingSlots.length > 0) {
        slotId = existingSlots[0].id;
      } else {
        const newSlot = await postRepository.createSlot(variantId, new Date());
        slotId = newSlot.id;
      }
    }

    // 4. Derive deterministic publication identity: SAME VARIANT + SAME SLOT = EXACTLY ONE PUBLICATION
    const idempotencyKey = customIdempotencyKey || `${variantId}:${slotId}`;

    // 5. IDEMPOTENCY CHECK: Inspect DB ledger for pre-existing successful attempt BEFORE approval check
    const existingAttempt =
      (await postRepository.getPublishAttemptByIdempotencyKey(idempotencyKey)) ||
      (await postRepository.getPublishAttemptByVariantAndSlot(variantId, slotId));

    if (existingAttempt && existingAttempt.status === 'success') {
      return {
        attempt: existingAttempt,
        isReplay: true,
        variant,
        url: (existingAttempt.metadata as any)?.url || null
      };
    }

    // 6. APPROVAL GATE ENFORCEMENT: For new publications, only approved variants can enter pipeline
    assertVariantApprovedForScheduling(variant);

    // 7. Record pending attempt in DB ledger
    const attempt = await postRepository.createPublishAttempt({
      variantId,
      slotId,
      idempotencyKey,
      status: 'pending'
    });

    // 8. Resolve publisher adapter cleanly via PublisherRegistry (No platform branching)
    const publisher = publisherRegistry.getPublisher(variant.platform);

    // 9. Execute platform publication
    const publishInput: PublishInput = {
      variantId: variant.id,
      content: variant.content,
      platform: variant.platform,
      idempotencyKey,
      scheduledSlotId: slotId
    };

    let publishResult: PublishResult;
    try {
      publishResult = await publisher.publish(publishInput);
    } catch (err: any) {
      // Record failed attempt safely
      await postRepository.updatePublishAttempt(attempt.id, {
        status: 'failed',
        completed_at: new Date(),
        error_info: {
          code: 'ADAPTER_EXECUTION_ERROR',
          message: err.message || 'Unexpected failure executing social adapter.'
        }
      });
      const failureErr = new Error('Social media publication failed during adapter execution.');
      (failureErr as any).statusCode = 500;
      throw failureErr;
    }

    // 10. Handle publication result
    if (publishResult.success) {
      const updatedAttempt = await postRepository.updatePublishAttempt(attempt.id, {
        status: 'success',
        completed_at: publishResult.publishedAt,
        external_post_id: publishResult.externalPostId || null,
        metadata: publishResult.url ? { url: publishResult.url } : null
      });

      // Update variant status to published
      const updatedVariant = await postRepository.updateVariant(variantId, {
        status: 'published'
      });

      await postRepository.createAuditLog(variantId, 'approved', 'published', `Published via ${publisher.platform}`);

      return {
        attempt: updatedAttempt,
        isReplay: false,
        variant: updatedVariant,
        url: publishResult.url || null
      };
    } else {
      const updatedAttempt = await postRepository.updatePublishAttempt(attempt.id, {
        status: 'failed',
        completed_at: new Date(),
        error_info: publishResult.error || { code: 'PUBLISH_FAILED', message: 'Publication was rejected by platform.' }
      });

      const failureErr = new Error(publishResult.error?.message || 'Social media publication failed.');
      (failureErr as any).statusCode = 502;
      (failureErr as any).details = updatedAttempt;
      throw failureErr;
    }
  }

  public async getPublishAttemptsForVariant(variantId: string): Promise<PublishAttempt[]> {
    const variant = await postRepository.getVariantById(variantId);
    if (!variant) {
      const err = new Error(`Variant not found with ID: ${variantId}`);
      (err as any).statusCode = 404;
      throw err;
    }
    return postRepository.getPublishAttemptsByVariantId(variantId);
  }

  public async getPublishAttemptById(attemptId: string): Promise<PublishAttempt | null> {
    return postRepository.getPublishAttemptById(attemptId);
  }
}

export const publishingService = new PublishingService();
