import { SocialPublisher } from './SocialPublisher.js';
import { DiscordPublisher } from './DiscordPublisher.js';
import { MockXPublisher } from './MockXPublisher.js';
import { MockLinkedInPublisher } from './MockLinkedInPublisher.js';
import { PlatformType } from '../models/types.js';

export class PublisherRegistry {
  private publishers: Map<PlatformType, SocialPublisher> = new Map();

  constructor() {
    this.registerPublisher(new DiscordPublisher());
    this.registerPublisher(new MockXPublisher());
    this.registerPublisher(new MockLinkedInPublisher());
  }

  public registerPublisher(publisher: SocialPublisher): void {
    this.publishers.set(publisher.platform, publisher);
  }

  public getPublisher(platform: PlatformType): SocialPublisher {
    const publisher = this.publishers.get(platform);
    if (!publisher) {
      throw new Error(`No registered publisher adapter found for platform: ${platform}`);
    }
    return publisher;
  }

  public getDefaultPublisher(): SocialPublisher {
    const defaultPlatform = (process.env.SOCIAL_ADAPTER || 'discord') as PlatformType;
    return this.getPublisher(defaultPlatform);
  }

  public hasPublisher(platform: PlatformType): boolean {
    return this.publishers.has(platform);
  }
}

export const publisherRegistry = new PublisherRegistry();
