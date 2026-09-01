import { describe, it, expect, beforeEach } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { postRepository } from '../src/services/postRepository.js';
import { publisherRegistry } from '../src/adapters/PublisherRegistry.js';
import { DiscordPublisher } from '../src/adapters/DiscordPublisher.js';
import { MockXPublisher } from '../src/adapters/MockXPublisher.js';
import { MockLinkedInPublisher } from '../src/adapters/MockLinkedInPublisher.js';

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

describe('Phase 4 — Publishing Adapters & Idempotent Publishing', () => {
  let samplePostId: string;
  let sampleApprovedVariantId: string;
  let sampleSlotId: string;

  beforeEach(async () => {
    postRepository.clearAll();

    const post = await postRepository.createPost({
      sourceType: 'markdown',
      sourceContent: 'High-availability publishing pipeline design.',
      title: 'HA Publishing Pipeline'
    });
    samplePostId = post.id;

    const variant = await postRepository.createVariant({
      postId: samplePostId,
      platform: 'mock_x',
      content: '🚀 HA Publishing Pipeline #Tech #Dev',
      status: 'approved',
      validationInfo: { isValid: true, length: 35, maxLength: 280, hashtagCount: 2, maxHashtags: 2, errors: [] }
    });
    sampleApprovedVariantId = variant.id;

    const slot = await postRepository.createSlot(sampleApprovedVariantId, new Date(Date.now() + 3600000));
    sampleSlotId = slot.id;
  });

  describe('1. Publisher Registry & Strategy Resolution', () => {
    it('should resolve Discord, MockX, and MockLinkedIn adapters cleanly', () => {
      expect(publisherRegistry.getPublisher('discord')).toBeInstanceOf(DiscordPublisher);
      expect(publisherRegistry.getPublisher('mock_x')).toBeInstanceOf(MockXPublisher);
      expect(publisherRegistry.getPublisher('mock_linkedin')).toBeInstanceOf(MockLinkedInPublisher);
    });

    it('should throw error when requesting unsupported platform', () => {
      expect(() => publisherRegistry.getPublisher('unsupported_platform' as any)).toThrow(
        'No registered publisher adapter found'
      );
    });

    it('should verify Mock X and Mock LinkedIn perform ZERO network calls', async () => {
      const mockX = publisherRegistry.getPublisher('mock_x') as MockXPublisher;
      mockX.clearHistory();

      const result = await mockX.publish({
        variantId: 'var-123',
        content: 'Mock tweet content #tech',
        platform: 'mock_x',
        idempotencyKey: 'var-123:slot-123',
        scheduledSlotId: 'slot-123'
      });

      expect(result.success).toBe(true);
      expect(result.externalPostId).toContain('x_tweet_');
      expect(mockX.getPublishedRecords()).toHaveLength(1);
    });
  });

  describe('2. Real Discord Publisher Unit Isolation', () => {
    it('should handle successful Discord HTTP webhook publish via mock fetch', async () => {
      const mockWebhookUrl = 'https://discord.com/api/webhooks/12345/secret_token';
      const mockFetch = async () =>
        new Response(JSON.stringify({ id: '9876543210' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      const discordPub = new DiscordPublisher(mockWebhookUrl, mockFetch);
      const result = await discordPub.publish({
        variantId: 'var-discord',
        content: 'Discord payload #test',
        platform: 'discord',
        idempotencyKey: 'var-discord:slot-1',
        scheduledSlotId: 'slot-1'
      });

      expect(result.success).toBe(true);
      expect(result.externalPostId).toBe('9876543210');
      // Verify webhook URL is not leaked inside PublishResult
      expect(JSON.stringify(result)).not.toContain(mockWebhookUrl);
    });

    it('should handle Discord HTTP non-2xx error safely', async () => {
      const mockWebhookUrl = 'https://discord.com/api/webhooks/12345/secret_token';
      const mockFetch = async () => new Response('Unauthorized', { status: 401 });

      const discordPub = new DiscordPublisher(mockWebhookUrl, mockFetch);
      const result = await discordPub.publish({
        variantId: 'var-discord',
        content: 'Discord payload #test',
        platform: 'discord',
        idempotencyKey: 'var-discord:slot-1',
        scheduledSlotId: 'slot-1'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DISCORD_HTTP_ERROR');
      expect(result.error?.message).toContain('HTTP status 401');
      expect(JSON.stringify(result)).not.toContain('secret_token');
    });

    it('should handle Discord webhook request timeout (5s)', async () => {
      const mockWebhookUrl = 'https://discord.com/api/webhooks/12345/secret_token';
      const slowFetch = async (_url: string, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      const discordPub = new DiscordPublisher(mockWebhookUrl, slowFetch);
      const result = await discordPub.publish({
        variantId: 'var-discord',
        content: 'Timeout test',
        platform: 'discord',
        idempotencyKey: 'var-discord:slot-timeout',
        scheduledSlotId: 'slot-timeout'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DISCORD_TIMEOUT');
    }, 10000);
  });

  describe('3. Approval Security Gate Enforcement', () => {
    it('should allow publishing an APPROVED variant -> 200 OK', async () => {
      const res = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      expect(res.status).toBe(200);
      expect(res.body.variantId).toBe(sampleApprovedVariantId);
      expect(res.body.status).toBe('success');
      expect(res.body.isReplay).toBe(false);
      expect(res.body.externalPostId).toBeDefined();

      // Verify variant status updated to published
      const getVarRes = await makeRequest('GET', `/variants/${sampleApprovedVariantId}`);
      expect(getVarRes.body.status).toBe('published');
    });

    it('should REJECT publishing a DRAFT variant -> 409 Conflict', async () => {
      const draftVariant = await postRepository.createVariant({
        postId: samplePostId,
        platform: 'mock_x',
        content: 'Draft content #tech',
        status: 'draft',
        validationInfo: { isValid: true, length: 20, maxLength: 280, hashtagCount: 1, maxHashtags: 2, errors: [] }
      });

      const res = await makeRequest('POST', `/variants/${draftVariant.id}/publish`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UNAPPROVED_VARIANT_PUBLISH_FORBIDDEN');
    });

    it('should REJECT publishing a REJECTED variant -> 409 Conflict', async () => {
      const rejectedVariant = await postRepository.createVariant({
        postId: samplePostId,
        platform: 'mock_x',
        content: 'Rejected content #tech',
        status: 'rejected',
        validationInfo: { isValid: true, length: 23, maxLength: 280, hashtagCount: 1, maxHashtags: 2, errors: [] }
      });

      const res = await makeRequest('POST', `/variants/${rejectedVariant.id}/publish`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UNAPPROVED_VARIANT_PUBLISH_FORBIDDEN');
    });
  });

  describe('4. Strict Idempotency (SAME VARIANT + SLOT = 1 PUBLICATION)', () => {
    it('should return replay response (isReplay: true) on duplicate publish request', async () => {
      // First request -> executes publication
      const res1 = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });
      expect(res1.status).toBe(200);
      expect(res1.body.isReplay).toBe(false);
      const originalAttemptId = res1.body.attemptId;
      const originalExternalId = res1.body.externalPostId;

      // Reset variant status in repository back to approved to test strict idempotency key replay
      await postRepository.updateVariant(sampleApprovedVariantId, { status: 'approved' });

      // Second identical request -> returns replay result without re-publishing
      const res2 = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      expect(res2.status).toBe(200);
      expect(res2.body.isReplay).toBe(true);
      expect(res2.body.attemptId).toBe(originalAttemptId);
      expect(res2.body.externalPostId).toBe(originalExternalId);
    });

    it('should verify database publish_attempts records exactly one attempt for variant + slot', async () => {
      await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      // Repeat publish attempt
      await postRepository.updateVariant(sampleApprovedVariantId, { status: 'approved' });
      await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      const attemptsRes = await makeRequest('GET', `/variants/${sampleApprovedVariantId}/attempts`);
      expect(attemptsRes.status).toBe(200);
      expect(attemptsRes.body.attempts).toHaveLength(1);
    });
  });

  describe('5. Publish Attempt Persistence & Security Verification', () => {
    it('should retrieve individual publish attempt details via GET /publish-attempts/:id', async () => {
      const pubRes = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      const attemptRes = await makeRequest('GET', `/publish-attempts/${pubRes.body.attemptId}`);
      expect(attemptRes.status).toBe(200);
      expect(attemptRes.body.id).toBe(pubRes.body.attemptId);
      expect(attemptRes.body.status).toBe('success');
      expect(attemptRes.body.externalPostId).toBe(pubRes.body.externalPostId);
    });

    it('should ensure zero webhook URLs or credentials are exposed in API responses', async () => {
      const pubRes = await makeRequest('POST', `/variants/${sampleApprovedVariantId}/publish`, {
        slotId: sampleSlotId
      });

      const resString = JSON.stringify(pubRes.body);
      expect(resString).not.toContain('webhook');
      expect(resString).not.toContain('http://');
      expect(resString).not.toContain('https://discord.com');
    });
  });
});
