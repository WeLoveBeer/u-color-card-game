import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from './env.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly enabled = Boolean(process.env.REDIS_URL);
  readonly client = new Redis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  async onModuleDestroy(): Promise<void> {
    if (this.enabled) {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
  }
}
