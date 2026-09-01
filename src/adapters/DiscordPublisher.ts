import { SocialPublisher, PublishInput, PublishResult } from './SocialPublisher.js';
import { PlatformType } from '../models/types.js';

export class DiscordPublisher implements SocialPublisher {
  public readonly platform: PlatformType = 'discord';
  private webhookUrl: string | undefined;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  }

  public async publish(input: PublishInput): Promise<PublishResult> {
    if (!this.webhookUrl) {
      return {
        success: false,
        platform: this.platform,
        publishedAt: new Date(),
        error: {
          code: 'DISCORD_WEBHOOK_MISSING',
          message: 'DISCORD_WEBHOOK_URL environment variable is not configured.'
        }
      };
    }

    // Phase 1 Design Skeleton - HTTP fetch implementation to Discord Webhook will be executed in Phase 2
    return {
      success: true,
      platform: this.platform,
      externalPostId: `discord_msg_${Date.now()}_${input.variantId.substring(0, 8)}`,
      publishedAt: new Date(),
      url: undefined,
      error: null
    };
  }
}
