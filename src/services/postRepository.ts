import {
  Post,
  Variant,
  Slot,
  VariantAuditLog,
  SourceType,
  PlatformType,
  VariantStatus,
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

export class PostRepository {
  private postsMap = new Map<string, Post>();
  private variantsMap = new Map<string, Variant>();
  private slotsMap = new Map<string, Slot>();
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
    this.auditLogsMap.clear();
  }
}

export const postRepository = new PostRepository();
