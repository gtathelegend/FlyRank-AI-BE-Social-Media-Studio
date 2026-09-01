import { describe, it, expect } from 'vitest';
import { PLATFORM_CONSTRAINTS, getPlatformConstraint } from '../src/config/platformConstraints.js';
import { isValidVariantStateTransition } from '../src/models/types.js';
import { publisherRegistry } from '../src/adapters/PublisherRegistry.js';
import { envSchema } from '../src/config/env.js';
import fs from 'fs';
import path from 'path';

describe('Phase 1 - Design & Configuration Verification', () => {
  it('should define platform constraint profiles for discord, mock_x, and mock_linkedin', () => {
    expect(PLATFORM_CONSTRAINTS.discord).toBeDefined();
    expect(PLATFORM_CONSTRAINTS.mock_x).toBeDefined();
    expect(PLATFORM_CONSTRAINTS.mock_linkedin).toBeDefined();

    expect(PLATFORM_CONSTRAINTS.discord.maxLength).toBe(2000);
    expect(PLATFORM_CONSTRAINTS.discord.tone).toBe('conversational');
    expect(PLATFORM_CONSTRAINTS.discord.maxHashtags).toBe(3);

    expect(PLATFORM_CONSTRAINTS.mock_x.maxLength).toBe(280);
    expect(PLATFORM_CONSTRAINTS.mock_x.tone).toBe('concise');
    expect(PLATFORM_CONSTRAINTS.mock_x.maxHashtags).toBe(2);

    expect(PLATFORM_CONSTRAINTS.mock_linkedin.maxLength).toBe(3000);
    expect(PLATFORM_CONSTRAINTS.mock_linkedin.tone).toBe('professional');
    expect(PLATFORM_CONSTRAINTS.mock_linkedin.maxHashtags).toBe(5);
  });

  it('should throw error when requesting unknown platform profile', () => {
    expect(() => getPlatformConstraint('unknown_platform')).toThrow('Unknown platform constraint requested');
  });

  it('should strictly enforce variant state transition rules', () => {
    // Valid transitions
    expect(isValidVariantStateTransition('draft', 'approved')).toBe(true);
    expect(isValidVariantStateTransition('draft', 'rejected')).toBe(true);
    expect(isValidVariantStateTransition('approved', 'published')).toBe(true);

    // Invalid transitions (Unapproved / Rejected cannot be scheduled/published)
    expect(isValidVariantStateTransition('draft', 'published')).toBe(false);
    expect(isValidVariantStateTransition('rejected', 'approved')).toBe(false);
    expect(isValidVariantStateTransition('rejected', 'published')).toBe(false);
    expect(isValidVariantStateTransition('published', 'draft')).toBe(false);
  });

  it('should register all required adapters (Discord, MockX, MockLinkedIn) in PublisherRegistry', () => {
    expect(publisherRegistry.hasPublisher('discord')).toBe(true);
    expect(publisherRegistry.hasPublisher('mock_x')).toBe(true);
    expect(publisherRegistry.hasPublisher('mock_linkedin')).toBe(true);

    const discordPub = publisherRegistry.getPublisher('discord');
    const mockXPub = publisherRegistry.getPublisher('mock_x');
    const mockLinkedInPub = publisherRegistry.getPublisher('mock_linkedin');

    expect(discordPub.platform).toBe('discord');
    expect(mockXPub.platform).toBe('mock_x');
    expect(mockLinkedInPub.platform).toBe('mock_linkedin');
  });

  it('should define environment variable schema correctly', () => {
    const shape = envSchema.shape;
    expect(shape.PORT).toBeDefined();
    expect(shape.NODE_ENV).toBeDefined();
    expect(shape.SOCIAL_ADAPTER).toBeDefined();
    expect(shape.DISCORD_WEBHOOK_URL).toBeDefined();
    expect(shape.POSTGRES_HOST).toBeDefined();
    expect(shape.REDIS_HOST).toBeDefined();
  });

  it('should verify that no secrets or discord webhook URLs are hard-coded in codebase', () => {
    const srcDir = path.resolve(__dirname, '../src');
    
    function scanDirectory(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Check for real discord webhook token patterns or hardcoded URLs
          expect(content).not.toMatch(/https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{20,}/);
        }
      }
    }

    scanDirectory(srcDir);
  });
});
