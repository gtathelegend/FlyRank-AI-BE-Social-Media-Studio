import { SocialPublisher, PublishInput, PublishResult } from './SocialPublisher.js';
import { PlatformType } from '../models/types.js';

export interface MockPublishRecord {
  input: PublishInput;
  timestamp: Date;
  mockPostId: string;
}

export class MockXPublisher implements SocialPublisher {
  public readonly platform: PlatformType = 'mock_x';
  private publishedRecords: MockPublishRecord[] = [];

  public async publish(input: PublishInput): Promise<PublishResult> {
    const mockPostId = `x_tweet_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    const record: MockPublishRecord = {
      input,
      timestamp: new Date(),
      mockPostId
    };

    this.publishedRecords.push(record);

    return {
      success: true,
      platform: this.platform,
      externalPostId: mockPostId,
      publishedAt: record.timestamp,
      url: `https://x.com/mock_user/status/${mockPostId}`,
      error: null
    };
  }

  public getPublishedRecords(): readonly MockPublishRecord[] {
    return this.publishedRecords;
  }

  public clearHistory(): void {
    this.publishedRecords = [];
  }
}
