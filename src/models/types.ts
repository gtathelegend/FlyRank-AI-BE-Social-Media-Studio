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
  rejection_reason?: string | null;
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

export interface VariantAuditLog {
  id: string;
  variant_id: string;
  previous_status: VariantStatus;
  new_status: VariantStatus;
  reason?: string | null;
  created_at: Date;
}

export class InvalidStateTransitionError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 409) {
    super(message);
    this.name = 'InvalidStateTransitionError';
    this.statusCode = statusCode;
  }
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

/**
 * Service-level security assertion making it impossible to schedule unapproved variants.
 * Rejects draft, rejected, or published variants with an InvalidStateTransitionError.
 */
export function assertVariantApprovedForScheduling(variant: Variant): void {
  if (variant.status !== 'approved') {
    throw new InvalidStateTransitionError(
      `Variant ${variant.id} cannot be scheduled because its status is '${variant.status}'. Only 'approved' variants may be scheduled.`,
      409
    );
  }
}
