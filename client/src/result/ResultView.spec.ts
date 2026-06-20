import { describe, expect, it } from 'vitest';
import type { GameOverMessage } from '@shared/index.js';
import { ResultView } from './ResultView.js';

const gameOver = (overrides: Partial<GameOverMessage['data']> = {}): GameOverMessage['data'] => ({
  gameId: 'g1',
  winnerId: 'p1',
  rankings: [
    { playerId: 'p2', rank: 2, remainCardCount: 3, score: 24 },
    { playerId: 'p1', rank: 1, remainCardCount: 0, score: 0 }
  ],
  seedHash: 'seed-hash-1',
  rewards: [],
  coinDeltas: [
    { playerId: 'p1', coinDelta: 30, coinAfter: 130 },
    { playerId: 'p2', coinDelta: -10, coinAfter: 90 }
  ],
  ...overrides
});

describe('ResultView', () => {
  it('会为胜利玩家构建人机结算页', () => {
    const model = new ResultView().build(gameOver(), 'p1', 'ai');

    expect(model.title).toBe('胜利');
    expect(model.subtitle).toBe('你率先打完了所有手牌');
    expect(model.rewardSummary).toEqual({ coinDelta: 30, coinAfter: 130 });
    expect(model.rankings.map((item) => item.playerId)).toEqual(['p1', 'p2']);
    expect(model.rankings[0]).toMatchObject({ currentUser: true, winner: true });
    expect(model.actions.map((action) => action.action)).toContain('ad_double');
    expect(model.fairness).toMatchObject({
      title: '本局由服务端随机洗牌',
      subtitle: '无控牌机制',
      gameId: 'g1',
      seedHash: 'seed-hash-1',
      action: 'rules'
    });
  });

  it('会为失败玩家构建好友房结算入口', () => {
    const model = new ResultView().build(gameOver(), 'p2', 'friend_room');

    expect(model.title).toBe('失败');
    expect(model.subtitle).toBe('本局第 2 名');
    expect(model.rewardSummary).toEqual({ coinDelta: -10, coinAfter: 90 });
    expect(model.actions.map((action) => action.action)).toEqual([
      'next_round',
      'back_room',
      'back_lobby',
      'share',
      'leaderboard'
    ]);
  });
});
