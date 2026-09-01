import { Post, Variant, PlatformType } from '../models/types.js';
import { validateVariantContent } from './constraintValidator.js';
import { postRepository } from './postRepository.js';
import { PLATFORM_CONSTRAINTS } from '../config/platformConstraints.js';

export interface GenerateVariantsOptions {
  platforms?: PlatformType[];
  customContentOverride?: Record<string, string>;
}

export class VariantGeneratorService {
  public async generateVariantsForPost(
    post: Post,
    options?: GenerateVariantsOptions
  ): Promise<Variant[]> {
    const targetPlatforms: PlatformType[] = options?.platforms || ['discord', 'mock_x', 'mock_linkedin'];
    const generatedVariants: Variant[] = [];

    for (const platform of targetPlatforms) {
      let content: string;

      if (options?.customContentOverride && options.customContentOverride[platform]) {
        content = options.customContentOverride[platform];
      } else {
        content = this.formatContentForPlatform(post, platform);
      }

      const validationInfo = validateVariantContent(content, platform);

      const variant = await postRepository.createVariant({
        postId: post.id,
        platform,
        content,
        status: 'draft',
        validationInfo
      });

      generatedVariants.push(variant);
    }

    return generatedVariants;
  }

  public formatContentForPlatform(post: Post, platform: PlatformType): string {
    const title = post.title || 'Featured Content';
    const rawContent = post.source_content;

    switch (platform) {
      case 'discord': {
        const header = `📢 **${title}**\n\n`;
        const body = rawContent.length > 1800 ? `${rawContent.substring(0, 1795)}...` : rawContent;
        const footer = `\n\nJoin the discussion! #FlyRank #Tech #Updates`;
        return `${header}${body}${footer}`;
      }

      case 'mock_x': {
        const prefix = `🚀 ${title}: `;
        const maxBodyLength = 280 - prefix.length - 25;
        const snippet = rawContent.length > maxBodyLength ? `${rawContent.substring(0, maxBodyLength - 3)}...` : rawContent;
        return `${prefix}${snippet}\n\n#FlyRank #Tech`;
      }

      case 'mock_linkedin': {
        const header = `💡 **${title}**\n\n`;
        const intro = `Key Insights & Analysis:\n`;
        const snippet = rawContent.length > 2500 ? `${rawContent.substring(0, 2490)}...` : rawContent;
        const footer = `\n\nWhat are your thoughts on this approach?\n\n#Professional #Engineering #FlyRank #Tech #Innovation`;
        return `${header}${intro}${snippet}${footer}`;
      }

      default:
        return rawContent;
    }
  }
}

export const variantGeneratorService = new VariantGeneratorService();
