import { PlatformType, ValidationInfo } from '../models/types.js';
import { getPlatformConstraint } from '../config/platformConstraints.js';

export function countHashtags(text: string): number {
  const matches = text.match(/#[\w]+/g);
  return matches ? matches.length : 0;
}

export function validateVariantContent(content: string, platform: PlatformType): ValidationInfo {
  const profile = getPlatformConstraint(platform);
  const errors: string[] = [];

  const length = content.length;
  const hashtagCount = countHashtags(content);

  if (length > profile.maxLength) {
    errors.push(`Content length (${length}) exceeds maximum limit of ${profile.maxLength} characters for ${profile.name}.`);
  }

  if (hashtagCount > profile.maxHashtags) {
    errors.push(`Hashtag count (${hashtagCount}) exceeds maximum limit of ${profile.maxHashtags} hashtags for ${profile.name}.`);
  }

  if (!content || content.trim().length === 0) {
    errors.push('Variant content cannot be empty.');
  }

  return {
    isValid: errors.length === 0,
    length,
    maxLength: profile.maxLength,
    hashtagCount,
    maxHashtags: profile.maxHashtags,
    errors
  };
}
