import type { GameState } from '@shared/domain/game-state.js';
import type { GameStateRepository } from './game-state.repository.js';
import { RedisService } from '../../common/redis.service.js';

export class RedisGameStateRepository implements GameStateRepository {
  constructor(private readonly redis: RedisService) {}

  async get(roomId: string): Promise<GameState | null> {
    const raw = await this.redis.client.get(this.key(roomId));
    return raw ? (JSON.parse(raw) as GameState) : null;
  }

  async save(roomId: string, state: GameState): Promise<void> {
    await this.redis.client.set(this.key(roomId), JSON.stringify(state), 'EX', 60 * 60 * 4);
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.client.del(this.key(roomId));
  }

  private key(roomId: string): string {
    return `game:${roomId}`;
  }
}
