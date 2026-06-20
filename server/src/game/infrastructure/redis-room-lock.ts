import type { RoomLock } from './room-lock.js';
import { RedisService } from '../../common/redis.service.js';

export class RedisRoomLock implements RoomLock {
  constructor(private readonly redis: RedisService) {}

  async withLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const key = `lock:room:${roomId}`;
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;
    const acquired = await this.redis.client.set(key, token, 'PX', 5000, 'NX');
    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const retry = await this.redis.client.set(key, token, 'PX', 5000, 'NX');
      if (!retry) {
        throw new Error('SERVER_BUSY');
      }
    }

    try {
      return await task();
    } finally {
      const current = await this.redis.client.get(key);
      if (current === token) {
        await this.redis.client.del(key);
      }
    }
  }
}
