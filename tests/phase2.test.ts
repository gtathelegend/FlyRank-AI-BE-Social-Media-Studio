import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { app } from '../src/app.js';
import { postRepository } from '../src/services/postRepository.js';
import { validateUrlForSsrf } from '../src/services/ssrfGuard.js';
import { fetchAndExtractUrlContent } from '../src/services/urlIngestionService.js';
import { validateVariantContent } from '../src/services/constraintValidator.js';
import { PLATFORM_CONSTRAINTS } from '../src/config/platformConstraints.js';
import http from 'http';

// Helper function to simulate HTTP requests against Express app
function makeRequest(
  method: 'GET' | 'POST',
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

describe('Phase 2 — Content Ingestion & Variant Generation', () => {
  beforeEach(() => {
    postRepository.clearAll();
  });

  describe('1. Post Ingestion (POST /posts)', () => {
    it('should create post with valid Markdown content -> 201', async () => {
      const res = await makeRequest('POST', '/posts', {
        sourceType: 'markdown',
        content: '# Test Article\n\nThis is a sample markdown article.',
        title: 'Test Title'
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.sourceType).toBe('markdown');
      expect(res.body.title).toBe('Test Title');
      expect(res.body.sourceContent).toContain('sample markdown article');
    });

    it('should ingest post with URL using mock fetcher -> 201', async () => {
      const mockFetch = async () =>
        new Response('<html><head><title>Mock Blog Title</title></head><body><p>Extracted content from web page.</p></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });

      const ingested = await fetchAndExtractUrlContent('https://example.com/blog/test', mockFetch);
      expect(ingested.title).toBe('Mock Blog Title');
      expect(ingested.content).toContain('Extracted content');

      const res = await makeRequest('POST', '/posts', {
        sourceType: 'markdown',
        content: ingested.content,
        title: ingested.title
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Mock Blog Title');
    });

    it('should reject missing source -> 400', async () => {
      const res = await makeRequest('POST', '/posts', {
        sourceType: 'markdown'
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject when both URL and Markdown content are supplied -> 400', async () => {
      const res = await makeRequest('POST', '/posts', {
        sourceType: 'markdown',
        url: 'https://example.com',
        content: 'Markdown text'
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid URL format -> 400', async () => {
      const res = await makeRequest('POST', '/posts', {
        sourceType: 'url',
        url: 'not-a-valid-url'
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty Markdown -> 400', async () => {
      const res = await makeRequest('POST', '/posts', {
        sourceType: 'markdown',
        content: '   '
      });
      expect(res.status).toBe(400);
    });
  });

  describe('2. SSRF Protection Security', () => {
    it('should reject localhost URL', () => {
      expect(validateUrlForSsrf('http://localhost:3000').allowed).toBe(false);
      expect(validateUrlForSsrf('http://127.0.0.1/admin').allowed).toBe(false);
      expect(validateUrlForSsrf('http://[::1]/status').allowed).toBe(false);
    });

    it('should reject private IP ranges (10.x.x.x, 172.16.x.x, 192.168.x.x, 169.254.x.x)', () => {
      expect(validateUrlForSsrf('http://10.0.0.1/secret').allowed).toBe(false);
      expect(validateUrlForSsrf('http://172.16.0.5/api').allowed).toBe(false);
      expect(validateUrlForSsrf('http://192.168.1.1/router').allowed).toBe(false);
      expect(validateUrlForSsrf('http://169.254.169.254/latest/meta-data').allowed).toBe(false);
    });

    it('should reject non-http/https protocols', () => {
      expect(validateUrlForSsrf('file:///etc/passwd').allowed).toBe(false);
      expect(validateUrlForSsrf('ftp://example.com/file').allowed).toBe(false);
      expect(validateUrlForSsrf('gopher://example.com').allowed).toBe(false);
    });

    it('should allow valid public HTTPS URLs', () => {
      expect(validateUrlForSsrf('https://example.com/blog/article').allowed).toBe(true);
      expect(validateUrlForSsrf('https://flyrank.ai/tech-blog').allowed).toBe(true);
    });
  });

  describe('3. Post Retrieval & Single Source of Truth', () => {
    it('should retrieve stored post via GET /posts/:id', async () => {
      const post = await postRepository.createPost({
        sourceType: 'markdown',
        sourceContent: 'Canonical article text',
        title: 'Stored Post Title'
      });

      const res = await makeRequest('GET', `/posts/${post.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(post.id);
      expect(res.body.sourceContent).toBe('Canonical article text');
    });

    it('should return 404 for non-existent post ID', async () => {
      const res = await makeRequest('GET', '/posts/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('4. Variant Generation (POST /posts/:id/variants)', () => {
    it('should generate draft variants for discord, mock_x, and mock_linkedin from stored post', async () => {
      const post = await postRepository.createPost({
        sourceType: 'markdown',
        sourceContent: 'Building high-performance distributed systems requires robust idempotency and clean architecture.',
        title: 'Distributed Systems In Depth'
      });

      const res = await makeRequest('POST', `/posts/${post.id}/variants`);
      expect(res.status).toBe(201);
      expect(res.body.postId).toBe(post.id);
      expect(res.body.variants).toHaveLength(3);

      const platforms = res.body.variants.map((v: any) => v.platform);
      expect(platforms).toContain('discord');
      expect(platforms).toContain('mock_x');
      expect(platforms).toContain('mock_linkedin');

      for (const variant of res.body.variants) {
        expect(variant.status).toBe('draft');
        expect(variant.validationInfo.isValid).toBe(true);
      }
    });

    it('should enforce Discord constraints (maxLength: 2000, maxHashtags: 3)', () => {
      const validContent = 'Discord post content #one #two #three';
      const validCheck = validateVariantContent(validContent, 'discord');
      expect(validCheck.isValid).toBe(true);

      const overlongContent = 'a'.repeat(2005);
      const overlongCheck = validateVariantContent(overlongContent, 'discord');
      expect(overlongCheck.isValid).toBe(false);
      expect(overlongCheck.errors[0]).toContain('exceeds maximum limit of 2000');

      const excessHashtags = 'Post with too many hashtags #one #two #three #four';
      const hashtagCheck = validateVariantContent(excessHashtags, 'discord');
      expect(hashtagCheck.isValid).toBe(false);
      expect(hashtagCheck.errors[0]).toContain('exceeds maximum limit of 3 hashtags');
    });

    it('should enforce Mock X constraints (maxLength: 280, maxHashtags: 2)', () => {
      const validContent = 'Short tweet #tech #news';
      const validCheck = validateVariantContent(validContent, 'mock_x');
      expect(validCheck.isValid).toBe(true);

      const overlongContent = 'b'.repeat(285);
      const overlongCheck = validateVariantContent(overlongContent, 'mock_x');
      expect(overlongCheck.isValid).toBe(false);
      expect(overlongCheck.errors[0]).toContain('exceeds maximum limit of 280');

      const excessHashtags = 'Tweet with excess hashtags #one #two #three';
      const hashtagCheck = validateVariantContent(excessHashtags, 'mock_x');
      expect(hashtagCheck.isValid).toBe(false);
      expect(hashtagCheck.errors[0]).toContain('exceeds maximum limit of 2 hashtags');
    });

    it('should enforce Mock LinkedIn constraints (maxLength: 3000, maxHashtags: 5)', () => {
      const validContent = 'Professional article insight #one #two #three #four #five';
      const validCheck = validateVariantContent(validContent, 'mock_linkedin');
      expect(validCheck.isValid).toBe(true);

      const excessHashtags = 'LinkedIn post #one #two #three #four #five #six';
      const hashtagCheck = validateVariantContent(excessHashtags, 'mock_linkedin');
      expect(hashtagCheck.isValid).toBe(false);
      expect(hashtagCheck.errors[0]).toContain('exceeds maximum limit of 5 hashtags');
    });

    it('should retrieve individual variant by ID via GET /variants/:id', async () => {
      const post = await postRepository.createPost({
        sourceType: 'markdown',
        sourceContent: 'Architecture pattern sample.',
        title: 'Pattern Sample'
      });

      const genRes = await makeRequest('POST', `/posts/${post.id}/variants`);
      const createdVariant = genRes.body.variants[0];

      const getRes = await makeRequest('GET', `/variants/${createdVariant.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(createdVariant.id);
      expect(getRes.body.platform).toBe(createdVariant.platform);
    });
  });
});
