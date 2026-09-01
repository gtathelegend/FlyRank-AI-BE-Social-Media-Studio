import { SocialPublisher, PublishInput, PublishResult } from './SocialPublisher.js';
import { PlatformType } from '../models/types.js';

export type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

export class DiscordPublisher implements SocialPublisher {
  public readonly platform: PlatformType = 'discord';
  private webhookUrl: string | undefined;
  private fetcher: FetchFunction;

  constructor(webhookUrl?: string, customFetch?: FetchFunction) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    this.fetcher = customFetch || globalThis.fetch;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // Append ?wait=true to receive Discord message payload with ID
      const targetUrl = this.webhookUrl.includes('?')
        ? `${this.webhookUrl}&wait=true`
        : `${this.webhookUrl}?wait=true`;

      const response = await this.fetcher(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: input.content
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          platform: this.platform,
          publishedAt: new Date(),
          error: {
            code: 'DISCORD_HTTP_ERROR',
            message: `Discord Webhook returned HTTP status ${response.status}`
          }
        };
      }

      let externalPostId: string = `discord_msg_${Date.now()}_${input.variantId.substring(0, 8)}`;
      try {
        const data = (await response.json()) as any;
        if (data && typeof data === 'object' && data.id) {
          externalPostId = String(data.id);
        }
      } catch {
        // Fallback if response body is empty or not JSON
      }

      return {
        success: true,
        platform: this.platform,
        externalPostId,
        publishedAt: new Date(),
        url: undefined,
        error: null
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          platform: this.platform,
          publishedAt: new Date(),
          error: {
            code: 'DISCORD_TIMEOUT',
            message: 'Discord Webhook request timed out after 5000ms'
          }
        };
      }

      return {
        success: false,
        platform: this.platform,
        publishedAt: new Date(),
        error: {
          code: 'DISCORD_PUBLISH_FAILED',
          message: 'Failed to publish content to Discord Webhook.'
        }
      };
    }
  }
}
