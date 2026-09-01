import { postRepository } from '../services/postRepository.js';
import { publishingService } from '../services/publishingService.js';
import { ScheduledJob, InvalidStateTransitionError } from '../models/types.js';

export interface WorkerOptions {
  pollIntervalMs?: number;
  leaseTimeoutSeconds?: number;
  batchSize?: number;
}

export class PublishWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private pollIntervalMs: number;
  private leaseTimeoutSeconds: number;
  private batchSize: number;

  constructor(options: WorkerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? (parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10));
    this.leaseTimeoutSeconds = options.leaseTimeoutSeconds ?? (parseInt(process.env.PROCESSING_LEASE_SECONDS || '60', 10));
    this.batchSize = options.batchSize ?? (parseInt(process.env.WORKER_BATCH_SIZE || '10', 10));
  }

  /**
   * Recovers jobs stuck in 'processing' state past the lease timeout.
   * Cross-references publish_attempts idempotency ledger to avoid duplicate publication.
   */
  public async recoverStaleJobs(): Promise<number> {
    const staleBefore = new Date(Date.now() - this.leaseTimeoutSeconds * 1000);
    const staleJobs = await postRepository.getStaleProcessingJobs(staleBefore);

    let recoveredCount = 0;
    for (const job of staleJobs) {
      // Check idempotency ledger for pre-existing successful publish attempt
      const attempt = await postRepository.getPublishAttemptByVariantAndSlot(job.variant_id, job.slot_id);
      if (attempt && attempt.status === 'success') {
        // External publish succeeded prior to process termination
        await postRepository.updateScheduledJob(job.id, {
          status: 'published',
          published_at: attempt.completed_at || new Date(),
          claimed_at: null
        });
        await postRepository.updateVariant(job.variant_id, { status: 'published' });
        recoveredCount++;
        continue;
      }

      // Not published yet: return to pending or mark failed if max attempts reached
      if (job.attempts >= job.max_attempts) {
        await postRepository.updateScheduledJob(job.id, {
          status: 'failed',
          last_error: { code: 'LEASE_EXPIRED_MAX_ATTEMPTS', message: 'Job processing lease expired and max attempts reached.' },
          claimed_at: null
        });
      } else {
        await postRepository.updateScheduledJob(job.id, {
          status: 'pending',
          claimed_at: null,
          available_at: new Date(Date.now() - 1000)
        });
      }
      recoveredCount++;
    }

    return recoveredCount;
  }

  /**
   * Claims and processes due jobs atomically.
   */
  public async processBatch(): Promise<ScheduledJob[]> {
    // 1. First recover any stale jobs from crashed workers
    await this.recoverStaleJobs();

    // 2. Atomically claim due jobs using SKIP LOCKED (or memory fallback)
    const claimedJobs = await postRepository.claimDueJobs(new Date(), this.batchSize);

    for (const job of claimedJobs) {
      await this.processSingleJob(job);
    }

    return claimedJobs;
  }

  /**
   * Processes an individual claimed job.
   */
  public async processSingleJob(job: ScheduledJob): Promise<void> {
    try {
      const result = await publishingService.publishVariant(job.variant_id, job.slot_id);

      if (result.attempt.status === 'success' || result.isReplay) {
        await postRepository.updateScheduledJob(job.id, {
          status: 'published',
          published_at: result.attempt.completed_at || new Date(),
          claimed_at: null,
          last_error: null
        });
      }
    } catch (err: any) {
      const isSecurityError =
        err instanceof InvalidStateTransitionError ||
        err.statusCode === 409 ||
        err.message?.includes('cannot be scheduled') ||
        err.message?.includes('status is');

      if (isSecurityError) {
        // Permanent failure: unapproved/draft variants cannot be published
        await postRepository.updateScheduledJob(job.id, {
          status: 'failed',
          claimed_at: null,
          last_error: {
            code: 'UNAPPROVED_VARIANT_FORBIDDEN',
            message: err.message
          }
        });
        return;
      }

      const nextAttempts = job.attempts + 1;
      const isMaxReached = nextAttempts >= job.max_attempts;

      if (isMaxReached) {
        await postRepository.updateScheduledJob(job.id, {
          status: 'failed',
          attempts: nextAttempts,
          claimed_at: null,
          last_error: {
            code: 'MAX_RETRIES_EXCEEDED',
            message: err.message || 'Maximum publish attempts reached.'
          }
        });
      } else {
        // Exponential backoff delay (5s * 2^(attempts-1))
        const backoffSeconds = Math.min(60, 5 * Math.pow(2, job.attempts));
        const availableAt = new Date(Date.now() + backoffSeconds * 1000);

        await postRepository.updateScheduledJob(job.id, {
          status: 'pending',
          attempts: nextAttempts,
          claimed_at: null,
          available_at: availableAt,
          last_error: {
            message: err.message || 'Publish attempt failed, scheduled for retry.',
            nextAttemptAt: availableAt.toISOString()
          }
        });
      }
    }
  }

  /**
   * Starts the worker polling loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[PublishWorker] Worker started. Polling every ${this.pollIntervalMs}ms (Lease timeout: ${this.leaseTimeoutSeconds}s)...`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err: any) {
        console.error(`[PublishWorker] Error during batch processing: ${err.message}`);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    poll();
  }

  /**
   * Stops the worker polling loop gracefully.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[PublishWorker] Worker stopped.');
  }
}

export const publishWorker = new PublishWorker();

// Standalone execution entry point
if (process.argv[1]?.includes('publishWorker')) {
  const worker = new PublishWorker();
  worker.start().catch((err) => {
    console.error(`[PublishWorker] Fatal worker startup error: ${err.message}`);
    process.exit(1);
  });
}
