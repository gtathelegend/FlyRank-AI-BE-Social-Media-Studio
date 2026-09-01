import {
  Post,
  Variant,
  Slot,
  PublishAttempt,
  VariantAuditLog,
  SourceType,
  PlatformType,
  VariantStatus,
  PublishAttemptStatus,
  ValidationInfo
} from '../models/types.js';
import crypto from 'crypto';

export interface CreatePostDTO {
  sourceType: SourceType;
  sourceUrl?: string | null;
  sourceContent: string;
  title?: string | null;
}

export interface CreateVariantDTO {
  postId: string;
  platform: PlatformType;
  content: string;
  status?: VariantStatus;
  validationInfo: ValidationInfo;
}

export interface CreatePublishAttemptDTO {
  variantId: string;
  slotId: string;
  idempotencyKey: string;
  status?: PublishAttemptStatus;
  metadata?: Record<string, unknown>;
}

export class PostRepository {
  private postsMap = new Map<string, Post>();
  private variantsMap = new Map<string, Variant>();
  private slotsMap = new Map<string, Slot>();
  private attemptsMap = new Map<string, PublishAttempt>();
  private auditLogsMap = new Map<string, VariantAuditLog[]>();

  public async createPost(dto: CreatePostDTO): Promise<Post> {
    const now = new Date();
    const post: Post = {
      id: crypto.randomUUID(),
      source_type: dto.sourceType,
      source_url: dto.sourceUrl || null,
      source_content: dto.sourceContent,
      title: dto.title || null,
      created_at: now,
      updated_at: now
    };

    this.postsMap.set(post.id, post);
    return post;
  }

  public async getPostById(id: string): Promise<Post | null> {
    return this.postsMap.get(id) || null;
  }

  public async createVariant(dto: CreateVariantDTO): Promise<Variant> {
    const now = new Date();
    const variant: Variant = {
      id: crypto.randomUUID(),
      post_id: dto.postId,
      platform: dto.platform,
      content: dto.content,
      status: dto.status || 'draft',
      validation_info: dto.validationInfo,
      rejection_reason: null,
      created_at: now,
      updated_at: now
    };

    this.variantsMap.set(variant.id, variant);
    return variant;
  }

  public async getVariantById(id: string): Promise<Variant | null> {
    return this.variantsMap.get(id) || null;
  }

  public async getVariantsByPostId(postId: string): Promise<Variant[]> {
    const results: Variant[] = [];
    for (const variant of this.variantsMap.values()) {
      if (variant.post_id === postId) {
        results.push(variant);
      }
    }
    return results;
  }

  public async updateVariant(id: string, updates: Partial<Variant>): Promise<Variant> {
    const variant = this.variantsMap.get(id);
    if (!variant) {
      throw new Error(`Variant not found: ${id}`);
    }

    const updated: Variant = {
      ...variant,
      ...updates,
      updated_at: new Date()
    };

    this.variantsMap.set(id, updated);
    return updated;
  }

  public async createSlot(variantId: string, scheduledAt: Date): Promise<Slot> {
    const now = new Date();
    const slot: Slot = {
      id: crypto.randomUUID(),
      variant_id: variantId,
      scheduled_at: scheduledAt,
      status: 'scheduled',
      created_at: now,
      updated_at: now
    };

    this.slotsMap.set(slot.id, slot);
    return slot;
  }

  public async getSlotById(id: string): Promise<Slot | null> {
    return this.slotsMap.get(id) || null;
  }

  public async getSlotsByVariantId(variantId: string): Promise<Slot[]> {
    const results: Slot[] = [];
    for (const slot of this.slotsMap.values()) {
      if (slot.variant_id === variantId) {
        results.push(slot);
      }
    }
    return results;
  }

  // Publish Attempts Data Access (Idempotency ledger)
  public async createPublishAttempt(dto: CreatePublishAttemptDTO): Promise<PublishAttempt> {
    // Unique invariant check: SAME VARIANT + SAME SLOT or SAME IDEMPOTENCY KEY
    const existing = await this.getPublishAttemptByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return existing;
    }

    const attempt: PublishAttempt = {
      id: crypto.randomUUID(),
      variant_id: dto.variantId,
      slot_id: dto.slotId,
      idempotency_key: dto.idempotencyKey,
      status: dto.status || 'pending',
      attempted_at: new Date(),
      completed_at: null,
      external_post_id: null,
      error_info: null,
      metadata: dto.metadata || null
    };

    this.attemptsMap.set(attempt.id, attempt);
    return attempt;
  }

  public async getPublishAttemptById(id: string): Promise<PublishAttempt | null> {
    return this.attemptsMap.get(id) || null;
  }

  public async getPublishAttemptByIdempotencyKey(key: string): Promise<PublishAttempt | null> {
    for (const attempt of this.attemptsMap.values()) {
      if (attempt.idempotency_key === key) {
        return attempt;
      }
    }
    return null;
  }

  public async getPublishAttemptByVariantAndSlot(variantId: string, slotId: string): Promise<PublishAttempt | null> {
    for (const attempt of this.attemptsMap.values()) {
      if (attempt.variant_id === variantId && attempt.slot_id === slotId) {
        return attempt;
      }
    }
    return null;
  }

  public async updatePublishAttempt(id: string, updates: Partial<PublishAttempt>): Promise<PublishAttempt> {
    const attempt = this.attemptsMap.get(id);
    if (!attempt) {
      throw new Error(`Publish attempt not found: ${id}`);
    }

    const updated: PublishAttempt = {
      ...attempt,
      ...updates
    };

    this.attemptsMap.set(id, updated);
    return updated;
  }

  public async getPublishAttemptsByVariantId(variantId: string): Promise<PublishAttempt[]> {
    const results: PublishAttempt[] = [];
    for (const attempt of this.attemptsMap.values()) {
      if (attempt.variant_id === variantId) {
        results.push(attempt);
      }
    }
    return results;
  }

  public async createAuditLog(
    variantId: string,
    previousStatus: VariantStatus,
    newStatus: VariantStatus,
    reason?: string | null
  ): Promise<VariantAuditLog> {
    const log: VariantAuditLog = {
      id: crypto.randomUUID(),
      variant_id: variantId,
      previous_status: previousStatus,
      new_status: newStatus,
      reason: reason || null,
      created_at: new Date()
    };

    const existing = this.auditLogsMap.get(variantId) || [];
    existing.push(log);
    this.auditLogsMap.set(variantId, existing);
    return log;
  }

  public async getVariantAuditLogs(variantId: string): Promise<VariantAuditLog[]> {
    return this.auditLogsMap.get(variantId) || [];
  }

  public clearAll(): void {
    this.postsMap.clear();
    this.variantsMap.clear();
    this.slotsMap.clear();
    this.attemptsMap.clear();
    this.auditLogsMap.clear();
  }
}

export const postRepository = new PostRepository();
