import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserProfileDto } from '@shared/protocol/http.js';
import type { GameState, Ranking } from '@shared/domain/game-state.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
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

describe('GameGateway AI 回合节奏', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AI 当前回合会延迟执行，不会立刻出牌', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = gameState({ currentPlayerId: 'ai_1', turnSeq: 3 });
    const nextState = gameState({ currentPlayerId: 'human', turnSeq: 4 });
    const commands = {
      getState: vi.fn(async () => state),
      runAutoPlay: vi.fn(async () => ({
        result: { ok: true, state: nextState },
        events: [{ type: 'turn_changed', currentPlayerId: 'human' }]
      }))
    };
    const gateway = new GameGateway({} as never, {} as never, commands as never, mapperStub() as never, new FakeTaskService() as never) as any;
    gateway.server = serverStub();

    gateway.scheduleAiTurnIfNeeded(state);

    expect(commands.runAutoPlay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(899);
    expect(commands.runAutoPlay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(commands.runAutoPlay).toHaveBeenCalledWith('r_ai', 'ai_1');
  });

  it('AI 延迟任务到点后如果 turnSeq 已变化则丢弃', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const scheduledState = gameState({ currentPlayerId: 'ai_1', turnSeq: 3 });
    const staleState = gameState({ currentPlayerId: 'ai_1', turnSeq: 4 });
    const commands = {
      getState: vi.fn(async () => staleState),
      runAutoPlay: vi.fn()
    };
    const gateway = new GameGateway({} as never, {} as never, commands as never, mapperStub() as never, new FakeTaskService() as never) as any;
    gateway.server = serverStub();

    gateway.scheduleAiTurnIfNeeded(scheduledState);
    await vi.advanceTimersByTimeAsync(900);

    expect(commands.runAutoPlay).not.toHaveBeenCalled();
  });
});

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'r_ai',
    gameId: 'g_ai',
    status: 'playing',
    ruleConfig: DEFAULT_RULE_CONFIG,
    players: [
      { id: 'human', seatIndex: 0, handCount: 3, online: true, isAi: false, isAutoPlaying: false },
      { id: 'ai_1', seatIndex: 1, handCount: 3, online: true, isAi: true, isAutoPlaying: false }
    ],
    deck: [],
    discardPile: [{ id: 'top', color: 'blue', type: 'number', value: '1' }],
    hands: { human: [], ai_1: [] },
    currentPlayerId: 'ai_1',
    direction: 1,
    currentColor: 'blue',
    pendingDrawCount: 0,
    calledUThisTurn: {},
    turnDeadline: Date.now() + 30000,
    turnSeq: 1,
    seedHash: 'seed',
    actionSeq: 0,
    ...overrides
  };
}

function mapperStub() {
  return {
    toMessages: () => [{ type: 'turn_changed', serverTime: Date.now(), data: { currentPlayerId: 'human', turnDeadline: Date.now() + 30000, turnSeq: 4 } }]
  };
}

function serverStub() {
  return {
    in: () => ({
      fetchSockets: async () => [{ data: { userId: 'human' }, emit: vi.fn() }]
    })
  };
}
