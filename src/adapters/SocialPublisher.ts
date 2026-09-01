import { PlatformType } from '../models/types.js';

export interface PublishInput {
  variantId: string;
  content: string;
  platform: PlatformType;
  idempotencyKey: string;
  scheduledSlotId: string;
  metadata?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  platform: PlatformType;
  externalPostId?: string | null;
  publishedAt: Date;
  url?: string | null;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
}

export interface SocialPublisher {
  readonly platform: PlatformType;
  publish(input: PublishInput): Promise<PublishResult>;
}
