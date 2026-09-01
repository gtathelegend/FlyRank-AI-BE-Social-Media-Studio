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
import { query, isDbConnected } from '../db/db.js';

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
    const id = crypto.randomUUID();

    const post: Post = {
      id,
      source_type: dto.sourceType,
      source_url: dto.sourceUrl || null,
      source_content: dto.sourceContent,
      title: dto.title || null,
      created_at: now,
      updated_at: now
    };

    this.postsMap.set(post.id, post);

    if (isDbConnected) {
      await query(
        `INSERT INTO posts (id, source_type, source_url, source_content, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [post.id, post.source_type, post.source_url, post.source_content, post.title, post.created_at, post.updated_at]
      );
    }

    return post;
  }

  public async getPostById(id: string): Promise<Post | null> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM posts WHERE id = $1`, [id]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          source_type: row.source_type,
          source_url: row.source_url,
          source_content: row.source_content,
          title: row.title,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };
      }
      return null;
    }
    return this.postsMap.get(id) || null;
  }

  public async createVariant(dto: CreateVariantDTO): Promise<Variant> {
    const now = new Date();
    const id = crypto.randomUUID();

    const variant: Variant = {
      id,
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

    if (isDbConnected) {
      await query(
        `INSERT INTO variants (id, post_id, platform, content, status, validation_info, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          variant.id,
          variant.post_id,
          variant.platform,
          variant.content,
          variant.status,
          JSON.stringify(variant.validation_info),
          variant.created_at,
          variant.updated_at
        ]
      );
    }

    return variant;
  }

  public async getVariantById(id: string): Promise<Variant | null> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM variants WHERE id = $1`, [id]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          post_id: row.post_id,
          platform: row.platform,
          content: row.content,
          status: row.status,
          validation_info: typeof row.validation_info === 'string' ? JSON.parse(row.validation_info) : row.validation_info,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };
      }
      return null;
    }
    return this.variantsMap.get(id) || null;
  }

  public async getVariantsByPostId(postId: string): Promise<Variant[]> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM variants WHERE post_id = $1`, [postId]);
      if (res) {
        return res.rows.map((row) => ({
          id: row.id,
          post_id: row.post_id,
          platform: row.platform,
          content: row.content,
          status: row.status,
          validation_info: typeof row.validation_info === 'string' ? JSON.parse(row.validation_info) : row.validation_info,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        }));
      }
    }
    const results: Variant[] = [];
    for (const variant of this.variantsMap.values()) {
      if (variant.post_id === postId) {
        results.push(variant);
      }
    }
    return results;
  }

  public async updateVariant(id: string, updates: Partial<Variant>): Promise<Variant> {
    const existing = await this.getVariantById(id);
    if (!existing) {
      throw new Error(`Variant not found: ${id}`);
    }

    const updated: Variant = {
      ...existing,
      ...updates,
      updated_at: new Date()
    };

    this.variantsMap.set(id, updated);

    if (isDbConnected) {
      await query(
        `UPDATE variants SET content = $1, status = $2, validation_info = $3, updated_at = $4 WHERE id = $5`,
        [updated.content, updated.status, JSON.stringify(updated.validation_info), updated.updated_at, id]
      );
    }

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

    if (isDbConnected) {
      await query(
        `INSERT INTO slots (id, variant_id, scheduled_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [slot.id, slot.variant_id, slot.scheduled_at, slot.status, slot.created_at, slot.updated_at]
      );
    }

    return slot;
  }

  public async getSlotById(id: string): Promise<Slot | null> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM slots WHERE id = $1`, [id]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          variant_id: row.variant_id,
          scheduled_at: new Date(row.scheduled_at),
          status: row.status,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        };
      }
      return null;
    }
    return this.slotsMap.get(id) || null;
  }

  public async getSlotsByVariantId(variantId: string): Promise<Slot[]> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM slots WHERE variant_id = $1`, [variantId]);
      if (res) {
        return res.rows.map((row) => ({
          id: row.id,
          variant_id: row.variant_id,
          scheduled_at: new Date(row.scheduled_at),
          status: row.status,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at)
        }));
      }
    }
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

    if (isDbConnected) {
      await query(
        `INSERT INTO publish_attempts (id, variant_id, slot_id, idempotency_key, status, attempted_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          attempt.id,
          attempt.variant_id,
          attempt.slot_id,
          attempt.idempotency_key,
          attempt.status,
          attempt.attempted_at,
          attempt.metadata ? JSON.stringify(attempt.metadata) : null
        ]
      );
    }

    return attempt;
  }

  public async getPublishAttemptById(id: string): Promise<PublishAttempt | null> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM publish_attempts WHERE id = $1`, [id]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          variant_id: row.variant_id,
          slot_id: row.slot_id,
          idempotency_key: row.idempotency_key,
          status: row.status,
          attempted_at: new Date(row.attempted_at),
          completed_at: row.completed_at ? new Date(row.completed_at) : null,
          external_post_id: row.external_post_id,
          error_info: row.error_info,
          metadata: row.metadata
        };
      }
      return null;
    }
    return this.attemptsMap.get(id) || null;
  }

  public async getPublishAttemptByIdempotencyKey(key: string): Promise<PublishAttempt | null> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM publish_attempts WHERE idempotency_key = $1`, [key]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          variant_id: row.variant_id,
          slot_id: row.slot_id,
          idempotency_key: row.idempotency_key,
          status: row.status,
          attempted_at: new Date(row.attempted_at),
          completed_at: row.completed_at ? new Date(row.completed_at) : null,
          external_post_id: row.external_post_id,
          error_info: row.error_info,
          metadata: row.metadata
        };
      }
      return null;
    }
    for (const attempt of this.attemptsMap.values()) {
      if (attempt.idempotency_key === key) {
        return attempt;
      }
    }
    return null;
  }

  public async getPublishAttemptByVariantAndSlot(variantId: string, slotId: string): Promise<PublishAttempt | null> {
    if (isDbConnected) {
      const res = await query(
        `SELECT * FROM publish_attempts WHERE variant_id = $1 AND slot_id = $2`,
        [variantId, slotId]
      );
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          variant_id: row.variant_id,
          slot_id: row.slot_id,
          idempotency_key: row.idempotency_key,
          status: row.status,
          attempted_at: new Date(row.attempted_at),
          completed_at: row.completed_at ? new Date(row.completed_at) : null,
          external_post_id: row.external_post_id,
          error_info: row.error_info,
          metadata: row.metadata
        };
      }
      return null;
    }
    for (const attempt of this.attemptsMap.values()) {
      if (attempt.variant_id === variantId && attempt.slot_id === slotId) {
        return attempt;
      }
    }
    return null;
  }

  public async updatePublishAttempt(id: string, updates: Partial<PublishAttempt>): Promise<PublishAttempt> {
    const attempt = await this.getPublishAttemptById(id);
    if (!attempt) {
      throw new Error(`Publish attempt not found: ${id}`);
    }

    const updated: PublishAttempt = {
      ...attempt,
      ...updates
    };

    this.attemptsMap.set(id, updated);

    if (isDbConnected) {
      await query(
        `UPDATE publish_attempts
         SET status = $1, completed_at = $2, external_post_id = $3, error_info = $4, metadata = $5
         WHERE id = $6`,
        [
          updated.status,
          updated.completed_at,
          updated.external_post_id,
          updated.error_info ? JSON.stringify(updated.error_info) : null,
          updated.metadata ? JSON.stringify(updated.metadata) : null,
          id
        ]
      );
    }

    return updated;
  }

  public async getPublishAttemptsByVariantId(variantId: string): Promise<PublishAttempt[]> {
    if (isDbConnected) {
      const res = await query(`SELECT * FROM publish_attempts WHERE variant_id = $1`, [variantId]);
      if (res) {
        return res.rows.map((row) => ({
          id: row.id,
          variant_id: row.variant_id,
          slot_id: row.slot_id,
          idempotency_key: row.idempotency_key,
          status: row.status,
          attempted_at: new Date(row.attempted_at),
          completed_at: row.completed_at ? new Date(row.completed_at) : null,
          external_post_id: row.external_post_id,
          error_info: row.error_info,
          metadata: row.metadata
        }));
      }
    }
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
