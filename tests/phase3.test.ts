import { describe, it, expect, beforeEach } from 'vitest';
import http from 'http';
import { app } from '../src/app.js';
import { postRepository } from '../src/services/postRepository.js';

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

describe('Phase 3 — Human Approval Workflow & Scheduling Gate', () => {
  let samplePostId: string;
  let sampleDraftVariantId: string;

  beforeEach(async () => {
    postRepository.clearAll();

    const post = await postRepository.createPost({
      sourceType: 'markdown',
      sourceContent: 'Architecture best practices for resilient backend applications.',
      title: 'Resilient Backend Architecture'
    });
    samplePostId = post.id;

    const variant = await postRepository.createVariant({
      postId: samplePostId,
      platform: 'discord',
      content: '📢 **Resilient Backend Architecture**\n\nArchitecture best practices for resilient backend applications.\n\n#Tech #Backend',
      status: 'draft',
      validationInfo: {
        isValid: true,
        length: 120,
        maxLength: 2000,
        hashtagCount: 2,
        maxHashtags: 3,
        errors: []
      }
    });
    sampleDraftVariantId = variant.id;
  });

  describe('1. Approval Workflow (POST /variants/:id/approve)', () => {
    it('should approve a valid draft variant -> 200 OK', async () => {
      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sampleDraftVariantId);
      expect(res.body.status).toBe('approved');
    });

    it('should return 404 for non-existent variant ID', async () => {
      const res = await makeRequest('POST', '/variants/00000000-0000-0000-0000-000000000000/approve');
      expect(res.status).toBe(404);
    });

    it('should reject approving an already approved variant -> 409 Conflict', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);

      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should reject approving a rejected variant -> 409 Conflict', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`, { reason: 'Irrelevant' });

      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should reject approving an overlong/invalid variant -> 422 Unprocessable Entity', async () => {
      const invalidVariant = await postRepository.createVariant({
        postId: samplePostId,
        platform: 'mock_x',
        content: 'x'.repeat(290), // Exceeds Mock X limit of 280
        status: 'draft',
        validationInfo: {
          isValid: false,
          length: 290,
          maxLength: 280,
          hashtagCount: 0,
          maxHashtags: 2,
          errors: ['Content exceeds maximum limit of 280 characters']
        }
      });

      const res = await makeRequest('POST', `/variants/${invalidVariant.id}/approve`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CONSTRAINT_VALIDATION_FAILED');
    });
  });

  describe('2. Rejection Workflow (POST /variants/:id/reject)', () => {
    it('should reject a draft variant and save rejection reason -> 200 OK', async () => {
      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`, {
        reason: 'Tone does not match brand guidelines.'
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.rejectionReason).toBe('Tone does not match brand guidelines.');
    });

    it('should reject when attempting to reject an already rejected variant -> 409 Conflict', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`, { reason: 'Initial reject' });

      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`, { reason: 'Second reject' });
      expect(res.status).toBe(409);
    });

    it('should reject when attempting to reject an approved variant -> 409 Conflict', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);

      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`);
      expect(res.status).toBe(409);
    });
  });

  describe('3. Variant Editing (PUT /variants/:id)', () => {
    it('should allow editing draft variant content with valid updates -> 200 OK', async () => {
      const res = await makeRequest('PUT', `/variants/${sampleDraftVariantId}`, {
        content: '📢 **Updated Architecture**\n\nUpdated content text.\n\n#Tech #New'
      });

      expect(res.status).toBe(200);
      expect(res.body.content).toContain('Updated content text');
      expect(res.body.status).toBe('draft');
    });

    it('should reset status to draft when editing an approved variant -> forcing re-review', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);

      const res = await makeRequest('PUT', `/variants/${sampleDraftVariantId}`, {
        content: '📢 **Edited Approved Content**\n\nNew body.\n\n#Tech'
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft'); // Forcing re-approval!
    });

    it('should reject editing variant with overlong content -> 422', async () => {
      const tweetVariant = await postRepository.createVariant({
        postId: samplePostId,
        platform: 'mock_x',
        content: 'Short tweet #tech',
        status: 'draft',
        validationInfo: { isValid: true, length: 17, maxLength: 280, hashtagCount: 1, maxHashtags: 2, errors: [] }
      });

      const res = await makeRequest('PUT', `/variants/${tweetVariant.id}`, {
        content: 'y'.repeat(300)
      });

      expect(res.status).toBe(422);
    });

    it('should reject editing variant with empty content -> 400 or 422', async () => {
      const res = await makeRequest('PUT', `/variants/${sampleDraftVariantId}`, {
        content: '   '
      });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject editing a published variant -> 409 Conflict', async () => {
      await postRepository.updateVariant(sampleDraftVariantId, { status: 'published' });

      const res = await makeRequest('PUT', `/variants/${sampleDraftVariantId}`, {
        content: 'Attempt to edit published variant'
      });

      expect(res.status).toBe(409);
    });
  });

  describe('4. Scheduling Hard Security Gate (POST /variants/:id/schedule)', () => {
    it('should allow scheduling an APPROVED variant -> 201 Created', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/schedule`, {
        scheduledAt: futureDate
      });

      expect(res.status).toBe(201);
      expect(res.body.variantId).toBe(sampleDraftVariantId);
      expect(res.body.status).toBe('scheduled');
    });

    it('should REJECT scheduling a DRAFT variant -> 409 Conflict', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/schedule`, {
        scheduledAt: futureDate
      });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain("Only 'approved' variants may be scheduled");
    });

    it('should REJECT scheduling a REJECTED variant -> 409 Conflict', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/reject`, { reason: 'Bad tone' });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await makeRequest('POST', `/variants/${sampleDraftVariantId}/schedule`, {
        scheduledAt: futureDate
      });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain("Only 'approved' variants may be scheduled");
    });

    it('should return 404 when scheduling a non-existent variant', async () => {
      const res = await makeRequest('POST', '/variants/00000000-0000-0000-0000-000000000000/schedule', {
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      expect(res.status).toBe(404);
    });
  });

  describe('5. Audit History (GET /variants/:id/history)', () => {
    it('should record chronological status audit history logs', async () => {
      await makeRequest('POST', `/variants/${sampleDraftVariantId}/approve`);
      await makeRequest('PUT', `/variants/${sampleDraftVariantId}`, { content: '📢 **Edited post**\n\nBody content.\n\n#Tech' });

      const res = await makeRequest('GET', `/variants/${sampleDraftVariantId}/history`);
      expect(res.status).toBe(200);
      expect(res.body.history.length).toBeGreaterThanOrEqual(2);

      expect(res.body.history[0].previousStatus).toBe('draft');
      expect(res.body.history[0].newStatus).toBe('approved');

      expect(res.body.history[1].previousStatus).toBe('approved');
      expect(res.body.history[1].newStatus).toBe('draft');
    });
  });
});
