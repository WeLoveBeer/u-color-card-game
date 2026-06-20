import { describe, expect, it } from 'vitest';
import { GameEngine } from '../domain/game-engine.js';
import { SeededRandomSource } from '../domain/deck/shuffle.service.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import { toVisibleGameState } from './visible-state.js';

describe('toVisibleGameState 玩家视角状态', () => {
  it('只下发当前玩家自己的手牌，其他玩家只暴露手牌数量', () => {
    const state = new GameEngine().createGame(
      { ...DEFAULT_RULE_CONFIG, playerCount: 3 },
      { playerIds: ['p1', 'p2', 'p3'], random: new SeededRandomSource(3) }
    );

    const visible = toVisibleGameState(state, 'p1');

    expect(visible.myHand).toEqual(state.hands.p1);
    expect(visible.myHand).not.toEqual(state.hands.p2);
    expect(visible.players.find((player) => player.id === 'p2')?.handCount).toBe(state.hands.p2.length);
    expect(JSON.stringify(visible)).not.toContain(state.hands.p2[0].id);
  });
});
