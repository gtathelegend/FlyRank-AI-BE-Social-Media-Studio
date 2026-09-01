import { describe, it, expect, beforeEach } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { postRepository } from '../src/services/postRepository.js';
import { PublishWorker } from '../src/workers/publishWorker.js';
import { publisherRegistry } from '../src/adapters/PublisherRegistry.js';
import { MockXPublisher } from '../src/adapters/MockXPublisher.js';

function makeRequest(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('Server address error'));
      }

      const postData = body ? JSON.stringify(body) : '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: addr.port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode || 500, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode || 500, body: data });
            }
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (postData) req.write(postData);
      req.end();
    });
  });
}

describe('Phase 5 — Scheduler, Worker, Crash Recovery & Publish History', () => {
  let samplePostId: string;
  let sampleApprovedVariantId: string;
  let worker: PublishWorker;

  beforeEach(async () => {
    await postRepository.clearAll();
    worker = new PublishWorker({ leaseTimeoutSeconds: 2, pollIntervalMs: 100 });

    const post = await postRepository.createPost({
      sourceType: 'markdown',
      sourceContent: 'Phase 5 worker and durable scheduler verification.',
      title: 'Phase 5 Durable Scheduler'
    });
    samplePostId = post.id;

    const variant = await postRepository.createVariant({
      postId: samplePostId,
      platform: 'mock_x',
      content: '🚀 Phase 5 Scheduler #Durable #Vitest',
      status: 'approved',
      validationInfo: { isValid: true, length: 35, maxLength: 280, hashtagCount: 2, maxHashtags: 2, errors: [] }
    });
    sampleApprovedVariantId = variant.id;
  });

  describe('A. Scheduling Security & Validation', () => {
    it('should schedule an APPROVED variant successfully -> 201 Created', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const res = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/schedule`, {
        scheduledAt: futureDate
      });

      expect(res.status).toBe(201);
      expect(res.body.variantId).toBe(sampleApprovedVariantId);
      expect(res.body.scheduledAt).toBeDefined();

      const job = await postRepository.getScheduledJobBySlotId(res.body.id);
      expect(job).not.toBeNull();
      expect(job?.status).toBe('pending');
    });

    it('should REJECT scheduling a DRAFT variant -> 409 Conflict', async () => {
      const draftVariant = await postRepository.createVariant({
        postId: samplePostId,
        platform: 'mock_x',
        content: 'Draft content #tech',
        status: 'draft',
        validationInfo: { isValid: true, length: 20, maxLength: 280, hashtagCount: 1, maxHashtags: 2, errors: [] }
      });

      const res = await makeRequest('POST', `/variants/${draftVariant.id}/schedule`, {
        scheduledAt: new Date(Date.now() + 3600000).toISOString()
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should REJECT scheduling a past timestamp -> 400 Bad Request', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const res = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/schedule`, {
        scheduledAt: pastDate
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('must be in the future');
    });
  });

  describe('B. Due-Job Selection & Atomic Claiming', () => {
    it('should NOT select future jobs, but select and claim due jobs', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000);
      const pastDate = new Date(now.getTime() - 10000);

      const slotFuture = await postRepository.createSlot(sampleApprovedVariantId, futureDate);
      await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slotFuture.id, scheduledAt: futureDate });

      const slotDue = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const jobDue = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slotDue.id, scheduledAt: pastDate });

      const dueJobs = await postRepository.getDueJobs(now);
      expect(dueJobs).toHaveLength(1);
      expect(dueJobs[0].id).toBe(jobDue.id);

      const claimed = await postRepository.claimDueJobs(now, 10);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].status).toBe('processing');

      // Subsequent claim attempt should return 0 claimed jobs (atomicity / lock test)
      const secondClaim = await postRepository.claimDueJobs(now, 10);
      expect(secondClaim).toHaveLength(0);
    });
  });

  describe('C. Worker Publishing & Failure Retries', () => {
    it('should process due jobs and update job status to published', async () => {
      const pastDate = new Date(Date.now() - 5000);
      const slot = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const job = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slot.id, scheduledAt: pastDate });

      const processed = await worker.processBatch();
      expect(processed).toHaveLength(1);

      const updatedJob = await postRepository.getScheduledJobById(job.id);
      expect(updatedJob?.status).toBe('published');
      expect(updatedJob?.published_at).not.toBeNull();

      const variant = await postRepository.getVariantById(sampleApprovedVariantId);
      expect(variant?.status).toBe('published');
    });

    it('should increment attempts and schedule retry on failure', async () => {
      const mockPublisher = publisherRegistry.getPublisher('mock_x') as MockXPublisher;
      // Force mock publisher failure once by corrupting input or throwing error in service
      const pastDate = new Date(Date.now() - 5000);
      const slot = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const job = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slot.id, scheduledAt: pastDate });

      // Temporary override publisher.publish to throw transient network error
      const origPublish = mockPublisher.publish.bind(mockPublisher);
      mockPublisher.publish = async () => {
        throw new Error('Transient network error');
      };

      await worker.processBatch();

      const retriedJob = await postRepository.getScheduledJobById(job.id);
      expect(retriedJob?.status).toBe('pending');
      expect(retriedJob?.attempts).toBe(1);
      expect(retriedJob?.last_error?.message).toContain('Social media publication failed');

      // Restore publisher
      mockPublisher.publish = origPublish;
    });

    it('should mark job failed permanently if max attempts are reached', async () => {
      const pastDate = new Date(Date.now() - 5000);
      const slot = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const job = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slot.id, scheduledAt: pastDate, maxAttempts: 1 });

      const mockPublisher = publisherRegistry.getPublisher('mock_x') as MockXPublisher;
      const origPublish = mockPublisher.publish.bind(mockPublisher);
      mockPublisher.publish = async () => {
        throw new Error('Fatal network error');
      };

      await worker.processBatch();

      const failedJob = await postRepository.getScheduledJobById(job.id);
      expect(failedJob?.status).toBe('failed');
      expect(failedJob?.attempts).toBe(1);
      expect(failedJob?.last_error?.code).toBe('MAX_RETRIES_EXCEEDED');

      mockPublisher.publish = origPublish;
    });
  });

  describe('D. Worker Crash Recovery & Idempotency Invariants', () => {
    it('should recover stale processing jobs after lease expiry without losing work', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const slot = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const job = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slot.id, scheduledAt: pastDate });

      // Manually simulate crash mid-batch: job set to 'processing' with old claimed_at
      await postRepository.updateScheduledJob(job.id, {
        status: 'processing',
        claimed_at: new Date(Date.now() - 10000)
      });

      const shortLeaseWorker = new PublishWorker({ leaseTimeoutSeconds: 2 });
      const recoveredCount = await shortLeaseWorker.recoverStaleJobs();
      expect(recoveredCount).toBe(1);

      const recoveredJob = await postRepository.getScheduledJobById(job.id);
      expect(recoveredJob?.status).toBe('pending');

      // Restarted worker processes the recovered job to completion
      await shortLeaseWorker.processBatch();
      const finalJob = await postRepository.getScheduledJobById(job.id);
      expect(finalJob?.status).toBe('published');
    });

    it('should NOT create duplicate external post if process crashed AFTER external publish', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const slot = await postRepository.createSlot(sampleApprovedVariantId, pastDate);
      const job = await postRepository.createScheduledJob({ variantId: sampleApprovedVariantId, slotId: slot.id, scheduledAt: pastDate });

      // Step 1: External publish succeeds & records attempt in DB ledger
      const attempt = await postRepository.createPublishAttempt({
        variantId: sampleApprovedVariantId,
        slotId: slot.id,
        idempotencyKey: `${sampleApprovedVariantId}:${slot.id}`,
        status: 'pending'
      });
      await postRepository.updatePublishAttempt(attempt.id, {
        status: 'success',
        completed_at: new Date(),
        external_post_id: 'mock_tweet_999'
      });

      // Step 2: Worker process crashes BEFORE marking scheduled_jobs table as published!
      await postRepository.updateScheduledJob(job.id, {
        status: 'processing',
        claimed_at: new Date(Date.now() - 10000)
      });

      // Step 3: Restarted worker recovers stale processing job
      const shortLeaseWorker = new PublishWorker({ leaseTimeoutSeconds: 2 });
      await shortLeaseWorker.recoverStaleJobs();

      // Step 4: Verify scheduled job transitioned directly to published using stored attempt
      const recoveredJob = await postRepository.getScheduledJobById(job.id);
      expect(recoveredJob?.status).toBe('published');
      expect(recoveredJob?.published_at).not.toBeNull();

      // Step 5: Verify idempotency ledger contains only 1 attempt
      const attempts = await postRepository.getPublishAttemptsByVariantId(sampleApprovedVariantId);
      expect(attempts).toHaveLength(1);
    });
  });

  describe('E. Publish History & Security Inspection', () => {
    it('should query publish history via GET /publish-history sorted newest first', async () => {
      const slot = await postRepository.createSlot(sampleApprovedVariantId, new Date());
      await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, { slotId: slot.id });

      const historyRes = await makeRequest('GET', '/publish-history');
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.total).toBeGreaterThanOrEqual(1);
      expect(historyRes.body.history[0].variantId).toBe(sampleApprovedVariantId);
      expect(historyRes.body.history[0].status).toBe('success');
      expect(historyRes.body.history[0].platform).toBe('mock_x');
    });

    it('should redact sensitive URLs and credentials from publish history errors', async () => {
      const slot = await postRepository.createSlot(sampleApprovedVariantId, new Date());
      const attempt = await postRepository.createPublishAttempt({
        variantId: sampleApprovedVariantId,
        slotId: slot.id,
        idempotencyKey: `${sampleApprovedVariantId}:${slot.id}`,
        status: 'failed'
      });

      await postRepository.updatePublishAttempt(attempt.id, {
        status: 'failed',
        error_info: {
          code: 'WEBHOOK_FAILED',
          message: 'HTTP error calling https://discord.com/api/webhooks/12345/secret_token'
        }
      });

      const historyRes = await makeRequest('GET', '/publish-history');
      expect(historyRes.status).toBe(200);
      const resText = JSON.stringify(historyRes.body);
      expect(resText).not.toContain('secret_token');
    });
  });
});
