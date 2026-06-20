import { describe, expect, it } from 'vitest';
import type { UserProfileDto } from '@shared/protocol/http.js';
import type { Ranking } from '@shared/domain/game-state.js';
import { GameGateway } from './game.gateway.js';

class FakeAuthService {
  private readonly users = new Map<string, UserProfileDto>([
    ['winner', { id: 'winner', nickname: '赢家', avatar: '', coin: 100 }],
    ['loser', { id: 'loser', nickname: '输家', avatar: '', coin: 30 }]
  ]);

  async getUser(userId: string): Promise<UserProfileDto | null> {
    return this.users.get(userId) ?? null;
  }

  async addCoin(userId: string, coinDelta: number): Promise<UserProfileDto | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, coin: Math.max(0, user.coin + coinDelta) };
    this.users.set(userId, next);
    return next;
  }
}

class FakeTaskService {
  calls: Array<{ winnerId: string; rankings: Ranking[] }> = [];

  async recordGameOver(winnerId: string, rankings: Ranking[]): Promise<void> {
    this.calls.push({ winnerId, rankings });
  }
}

describe('GameGateway 金币结算', () => {
  it('game_over 事件会按真实余额落账并替换 coinDeltas', async () => {
    const auth = new FakeAuthService();
    const tasks = new FakeTaskService();
    const gateway = new GameGateway(auth as never, {} as never, {} as never, {} as never, tasks as never) as unknown as {
      settleGameOverEvents(events: unknown[]): Promise<Array<{ type: string; coinDeltas: Array<{ playerId: string; coinDelta: number; coinAfter: number }> }>>;
    };

    const [event] = await gateway.settleGameOverEvents([
      {
        type: 'game_over',
        winnerId: 'winner',
        rankings: [
          { playerId: 'winner', rank: 1, remainCardCount: 0, score: 0 },
          { playerId: 'loser', rank: 2, remainCardCount: 2, score: 50 },
          { playerId: 'ai_1', rank: 3, remainCardCount: 3, score: 20 }
        ],
        coinDeltas: []
      }
    ]);

    expect(event.coinDeltas).toEqual([
      { playerId: 'winner', coinDelta: 50, coinAfter: 150 },
      { playerId: 'loser', coinDelta: -30, coinAfter: 0 },
      { playerId: 'ai_1', coinDelta: -20, coinAfter: 0 }
    ]);
    expect((await auth.getUser('winner'))?.coin).toBe(150);
    expect((await auth.getUser('loser'))?.coin).toBe(0);
    expect(tasks.calls).toHaveLength(1);
    expect(tasks.calls[0]?.winnerId).toBe('winner');
  });
});
