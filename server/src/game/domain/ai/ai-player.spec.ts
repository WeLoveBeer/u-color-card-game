import { describe, expect, it } from 'vitest';
import type { Card } from '@shared/domain/card.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { GameEngine } from '../game-engine.js';
import { SeededRandomSource } from '../deck/shuffle.service.js';
import { AiPlayer } from './ai-player.js';
import { LocalGameRunner } from './local-game-runner.js';

const ai = new AiPlayer();

function card(id: string, color: Card['color'], type: Card['type'], value?: string): Card {
  return { id, color, type, value };
}

function stateWithHands(hands: Record<PlayerId, Card[]>, top: Card, currentPlayerId = 'p1'): GameState {
  const ids = Object.keys(hands);
  return {
    roomId: 'r_ai',
    gameId: 'g_ai',
    status: 'playing',
    ruleConfig: { ...DEFAULT_RULE_CONFIG, playerCount: ids.length as 2 | 3 | 4 },
    players: ids.map((id, index) => ({
      id,
      seatIndex: index,
      handCount: hands[id].length,
      online: true,
      isAi: true,
      isAutoPlaying: false
    })),
    deck: [
      card('d1', 'blue', 'number', '1'),
      card('d2', 'green', 'number', '2'),
      card('d3', 'yellow', 'number', '3'),
      card('d4', 'red', 'number', '4')
    ],
    discardPile: [top],
    hands,
    currentPlayerId,
    direction: 1,
    currentColor: top.color,
    pendingDrawCount: 0,
    calledUThisTurn: {},
    turnDeadline: 0,
    seedHash: 'seed_ai',
    actionSeq: 0
  };
}

describe('AiPlayer 强 AI 基础策略', () => {
  it('能直接获胜时优先打出最后一张牌', () => {
    const state = stateWithHands(
      {
        p1: [card('win', 'red', 'number', '5')],
        p2: [card('p2', 'blue', 'number', '1')]
      },
      card('top', 'red', 'number', '9')
    );

    expect(ai.decideAction(state, 'p1')).toEqual({ type: 'play_card', cardIds: ['win'] });
  });

  it('下家只剩 1 张时优先使用压制牌', () => {
    const state = stateWithHands(
      {
        p1: [
          card('normal', 'red', 'number', '5'),
          card('plus2', 'red', 'plus_two', 'plus_two'),
          card('spare', 'blue', 'number', '7')
        ],
        p2: [card('p2_last', 'blue', 'number', '1')]
      },
      card('top', 'red', 'number', '9')
    );

    expect(ai.decideAction(state, 'p1')).toEqual({ type: 'play_card', cardIds: ['plus2'] });
  });

  it('打倒数第二张牌前会先喊 U', () => {
    const state = stateWithHands(
      {
        p1: [card('play', 'red', 'number', '5'), card('stay', 'blue', 'number', '1')],
        p2: [card('p2', 'green', 'number', '1')]
      },
      card('top', 'red', 'number', '9')
    );

    expect(ai.decideAction(state, 'p1')).toEqual({ type: 'call_u' });
  });

  it('看到可抓忘喊窗口会立即抓', () => {
    const state = stateWithHands(
      {
        p1: [card('p1', 'red', 'number', '5')],
        p2: [card('p2', 'green', 'number', '1')]
      },
      card('top', 'red', 'number', '9'),
      'p2'
    );
    state.missedCallWindow = {
      targetPlayerId: 'p1',
      openedAtActionSeq: 1,
      closesAfterPlayerId: 'p2'
    };

    expect(ai.decideAction(state, 'p2')).toEqual({ type: 'catch_missed_call', targetPlayerId: 'p1' });
  });

  it('本地 AI 对局可以自动结算', () => {
    const engine = new GameEngine();
    const initial = engine.createGame(
      { ...DEFAULT_RULE_CONFIG, playerCount: 2, initialCards: 5 },
      { playerIds: ['ai_1', 'ai_2'], random: new SeededRandomSource(7), seedHash: 'seed_7' }
    );
    const result = new LocalGameRunner(engine, ai).run(initial, 300);

    expect(result.state.status).toBe('finished');
    expect(result.actions.every((entry) => entry.ok)).toBe(true);
  });
});
