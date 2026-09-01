import { Post, Variant, SourceType, PlatformType, VariantStatus, ValidationInfo } from '../models/types.js';
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

  public clearAll(): void {
    this.postsMap.clear();
    this.variantsMap.clear();
  }
}

export const postRepository = new PostRepository();
