export type SourceType = 'url' | 'markdown';

export type PlatformType = 'discord' | 'mock_x' | 'mock_linkedin';

export type VariantStatus = 'draft' | 'approved' | 'rejected' | 'published';

export type SlotStatus = 'scheduled' | 'cancelled' | 'completed';

export type PublishAttemptStatus = 'pending' | 'success' | 'failed';

export interface Post {
  id: string;
  source_type: SourceType;
  source_url?: string | null;
  source_content: string;
  title?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ValidationInfo {
  isValid: boolean;
  length: number;
  maxLength: number;
  hashtagCount: number;
  maxHashtags: number;
  errors: string[];
}

export interface Variant {
  id: string;
  post_id: string;
  platform: PlatformType;
  content: string;
  status: VariantStatus;
  validation_info: ValidationInfo;
  created_at: Date;
  updated_at: Date;
}

export interface Slot {
  id: string;
  variant_id: string;
  scheduled_at: Date;
  status: SlotStatus;
  created_at: Date;
  updated_at: Date;
}

export interface PublishAttempt {
  id: string;
  variant_id: string;
  slot_id: string;
  idempotency_key: string;
  status: PublishAttemptStatus;
  attempted_at: Date;
  completed_at?: Date | null;
  external_post_id?: string | null;
  error_info?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Validates allowed variant state transitions.
 * Allowed:
 *  - draft -> approved
 *  - draft -> rejected
 *  - approved -> published
 */
export function isValidVariantStateTransition(current: VariantStatus, next: VariantStatus): boolean {
  const allowedTransitions: Record<VariantStatus, VariantStatus[]> = {
    draft: ['approved', 'rejected'],
    approved: ['published'],
    rejected: [],
    published: []
  };

  return allowedTransitions[current]?.includes(next) ?? false;
}
