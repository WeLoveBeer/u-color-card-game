import { describe, expect, it } from 'vitest';
import type { Card } from '@shared/domain/card.js';
import { DEFAULT_RULE_CONFIG, type RuleConfig } from '@shared/domain/rule-config.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { GameEngine } from './game-engine.js';

const engine = new GameEngine();

function card(id: string, color: Card['color'], type: Card['type'], value?: string): Card {
  return { id, color, type, value };
}

function stateWithHands(
  hands: Record<PlayerId, Card[]>,
  top: Card,
  currentPlayerId = 'p1',
  config: Partial<RuleConfig> = {}
): GameState {
  const playerIds = Object.keys(hands);
  const ruleConfig = { ...DEFAULT_RULE_CONFIG, playerCount: playerIds.length as 2 | 3 | 4, ...config };
  return {
    roomId: 'r_test',
    gameId: 'g_test',
    status: 'playing',
    ruleConfig,
    players: playerIds.map((id, index) => ({
      id,
      seatIndex: index,
      handCount: hands[id].length,
      online: true,
      isAi: false,
      isAutoPlaying: false
    })),
    deck: [
      card('d1', 'blue', 'number', '1'),
      card('d2', 'green', 'number', '2'),
      card('d3', 'yellow', 'number', '3'),
      card('d4', 'red', 'number', '4'),
      card('d5', 'blue', 'number', '5'),
      card('d6', 'green', 'number', '6')
    ],
    discardPile: [top],
    hands,
    currentPlayerId,
    direction: 1,
    currentColor: top.color,
    pendingDrawCount: 0,
    calledUThisTurn: {},
    turnDeadline: 0,
    turnSeq: 1,
    seedHash: 'seed_test',
    actionSeq: 0
  };
}

describe('GameEngine 规则引擎', () => {
  it('允许同色数字牌出牌并切换回合', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_red_5', 'red', 'number', '5'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_red_5']);

    expect(result.ok).toBe(true);
    expect(result.state.hands.p1).toHaveLength(1);
    expect(result.state.currentPlayerId).toBe('p2');
    expect(result.state.turnSeq).toBe(2);
    expect(result.state.turnDeadline).toBeGreaterThan(Date.now());
    expect(result.events.some((event) => event.type === 'card_played')).toBe(true);
  });

  it('拒绝不同色不同数字的非法出牌', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_blue_2']);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ILLEGAL_CARD');
  });

  it('Skip 会跳过下家', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_skip', 'red', 'skip', 'skip'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')],
        p3: [card('p3_yellow_1', 'yellow', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_skip']);

    expect(result.ok).toBe(true);
    expect(result.state.currentPlayerId).toBe('p3');
    expect(result.events).toContainEqual({ type: 'effect_resolved', effectType: 'skip', targetPlayerIds: ['p2'] });
  });

  it('Reverse 在 3 人局会改变方向', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_reverse', 'red', 'reverse', 'reverse'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')],
        p3: [card('p3_yellow_1', 'yellow', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_reverse']);

    expect(result.ok).toBe(true);
    expect(result.state.direction).toBe(-1);
    expect(result.state.currentPlayerId).toBe('p3');
  });

  it('+2 默认让下家摸 2 张并跳过', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_plus_two', 'red', 'plus_two', 'plus_two'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')],
        p3: [card('p3_yellow_1', 'yellow', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_plus_two']);

    expect(result.ok).toBe(true);
    expect(result.state.hands.p2).toHaveLength(3);
    expect(result.state.currentPlayerId).toBe('p3');
    expect(result.events).toContainEqual({ type: 'card_drawn', playerId: 'p2', count: 2, drawReason: 'plus_two' });
  });

  it('变色牌必须选择颜色并更新当前颜色', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_wild', 'wild', 'wild_color', 'wild_color'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    expect(engine.playCards(state, 'p1', ['p1_wild']).errorCode).toBe('COLOR_REQUIRED');

    const result = engine.playCards(state, 'p1', ['p1_wild'], 'blue');
    expect(result.ok).toBe(true);
    expect(result.state.currentColor).toBe('blue');
  });

  it('+4 质疑成功时出牌者摸 4 张', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_plus_four', 'wild', 'wild_plus_four', 'wild_plus_four'), card('p1_red_2', 'red', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const played = engine.playCards(state, 'p1', ['p1_plus_four'], 'blue');
    expect(played.ok).toBe(true);
    expect(played.state.pendingChallenge?.challengerId).toBe('p2');

    const challenged = engine.respondPlusFour(played.state, 'p2', 'challenge');
    expect(challenged.ok).toBe(true);
    expect(challenged.state.hands.p1).toHaveLength(5);
    expect(challenged.events.some((event) => event.type === 'plus_four_challenge_result' && event.success)).toBe(true);
  });

  it('忘喊 U 会打开可抓窗口，抓中后罚 2 张', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_red_5', 'red', 'number', '5'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const played = engine.playCards(state, 'p1', ['p1_red_5']);
    expect(played.ok).toBe(true);
    expect(played.state.missedCallWindow?.targetPlayerId).toBe('p1');

    const caught = engine.catchMissedCall(played.state, 'p2', 'p1');
    expect(caught.ok).toBe(true);
    expect(caught.state.hands.p1).toHaveLength(3);
    expect(caught.state.missedCallWindow).toBeUndefined();
  });

  it('先喊 U 后出倒数第二张不会被抓', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_red_5', 'red', 'number', '5'), card('p1_blue_2', 'blue', 'number', '2')],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const called = engine.callU(state, 'p1');
    const played = engine.playCards(called.state, 'p1', ['p1_red_5']);

    expect(played.ok).toBe(true);
    expect(played.state.missedCallWindow).toBeUndefined();
  });

  it('同色全出开启时会自动带出当前颜色手牌', () => {
    const state = stateWithHands(
      {
        p1: [
          card('p1_dump', 'red', 'same_color_dump', 'same_color_dump'),
          card('p1_red_2', 'red', 'number', '2'),
          card('p1_red_skip', 'red', 'skip', 'skip'),
          card('p1_blue_5', 'blue', 'number', '5')
        ],
        p2: [card('p2_green_1', 'green', 'number', '1')]
      },
      card('top_red_9', 'red', 'number', '9'),
      'p1',
      { sameColorDump: true, specialPacks: ['same_color_dump'] }
    );

    const result = engine.playCards(state, 'p1', ['p1_dump']);

    expect(result.ok).toBe(true);
    expect(result.state.hands.p1.map((item) => item.id)).toEqual(['p1_blue_5']);
    const cardPlayed = result.events.find((event) => event.type === 'card_played');
    expect(cardPlayed?.type === 'card_played' && cardPlayed.publicCards.map((item) => item.id)).toEqual([
      'p1_dump',
      'p1_red_2',
      'p1_red_skip'
    ]);
  });

  it('出完最后一张牌立即结算', () => {
    const state = stateWithHands(
      {
        p1: [card('p1_red_5', 'red', 'number', '5')],
        p2: [card('p2_green_1', 'green', 'number', '1'), card('p2_wild', 'wild', 'wild_color', 'wild_color')]
      },
      card('top_red_9', 'red', 'number', '9')
    );

    const result = engine.playCards(state, 'p1', ['p1_red_5']);

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('finished');
    expect(result.events.some((event) => event.type === 'game_over' && event.winnerId === 'p1')).toBe(true);
  });
});
