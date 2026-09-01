export interface PlatformConstraintProfile {
  platform: 'discord' | 'mock_x' | 'mock_linkedin';
  name: string;
  maxLength: number;
  tone: 'conversational' | 'concise' | 'professional';
  maxHashtags: number;
  supportsMarkdown: boolean;
}

export const PLATFORM_CONSTRAINTS: Record<string, PlatformConstraintProfile> = {
  discord: {
    platform: 'discord',
    name: 'Discord (Community Webhook)',
    maxLength: 2000,
    tone: 'conversational',
    maxHashtags: 3,
    supportsMarkdown: true
  },
  mock_x: {
    platform: 'mock_x',
    name: 'Mock X (Short-Form Social)',
    maxLength: 280,
    tone: 'concise',
    maxHashtags: 2,
    supportsMarkdown: false
  },
  mock_linkedin: {
    platform: 'mock_linkedin',
    name: 'Mock LinkedIn (Long-Form Professional)',
    maxLength: 3000,
    tone: 'professional',
    maxHashtags: 5,
    supportsMarkdown: true
  }
};

export function getPlatformConstraint(platform: string): PlatformConstraintProfile {
  const constraint = PLATFORM_CONSTRAINTS[platform];
  if (!constraint) {
    throw new Error(`Unknown platform constraint requested: ${platform}`);
  }
  return constraint;
}
