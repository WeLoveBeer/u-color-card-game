import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from './env.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
