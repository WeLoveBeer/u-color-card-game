import type { Card, PlayableColor } from '@shared/domain/card.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { ScoreResolver } from '../scoring/score-resolver.js';
import { TurnResolver } from '../turn/turn-resolver.js';
import { getHand } from '../utils/state.js';
import type { AiAction, ScoredAiAction } from './ai-action.types.js';

export class AiScorer {
  private readonly scores = new ScoreResolver();
  private readonly turns = new TurnResolver();

  score(state: GameState, playerId: PlayerId, action: AiAction): ScoredAiAction {
    if (action.type === 'catch_missed_call') {
      return { action, score: 9000, reason: '抓忘喊是公开确定收益' };
    }
    if (action.type === 'call_u') {
      return { action, score: 8500, reason: '打倒数第二张前必须喊 U' };
    }
    if (action.type === 'plus_four_response') {
      return this.scorePlusFourResponse(state, playerId, action);
    }
    if (action.type === 'draw_card') {
      return { action, score: this.shouldAvoidBadPlay(state, playerId) ? 80 : -120, reason: '摸牌兜底' };
    }
    if (action.type === 'pass_turn') {
      return { action, score: -300, reason: '结束回合' };
    }

    const card = getHand(state, playerId).find((item) => item.id === action.cardIds[0]);
    if (!card) {
      return { action, score: -9999, reason: '不存在的牌' };
    }

    let score = 100;
    const handAfter = getHand(state, playerId).length - 1;
    if (handAfter === 0) {
      score += 10000;
    } else if (handAfter === 1) {
      score += 1200;
    }

    score += this.scoreCardType(card);
    score += this.scoreColorChoice(state, playerId, action.chooseColor);
    score += this.scorePressure(state, card);

    return { action, score, reason: `出 ${card.type}` };
  }

  private scoreCardType(card: Card): number {
    switch (card.type) {
      case 'skip':
        return 180;
      case 'reverse':
        return 120;
      case 'plus_two':
        return 240;
      case 'wild_color':
        return 280;
      case 'wild_plus_four':
        return 450;
      case 'same_color_dump':
        return 260;
      default:
        return 20 - this.scores.cardScore(card) * 0.2;
    }
  }

  private scorePressure(state: GameState, card: Card): number {
    const nextPlayerId = this.turns.nextPlayerId(state);
    const nextHandCount = this.publicHandCount(state, nextPlayerId);
    if (nextHandCount !== 1) {
      return 0;
    }
    if (card.type === 'plus_two') {
      return 1000;
    }
    if (card.type === 'wild_plus_four') {
      return 1200;
    }
    if (card.type === 'skip') {
      return 900;
    }
    if (card.type === 'reverse' && state.players.length === 2) {
      return 900;
    }
    return -1000;
  }

  private scoreColorChoice(state: GameState, playerId: PlayerId, chooseColor?: PlayableColor): number {
    if (!chooseColor) {
      return 0;
    }
    const count = getHand(state, playerId).filter((card) => card.color === chooseColor).length;
    return count * 80 + 200;
  }

  private scorePlusFourResponse(state: GameState, playerId: PlayerId, action: Extract<AiAction, { type: 'plus_four_response' }>): ScoredAiAction {
    if (action.action === 'stack_plus_four') {
      return { action, score: 650, reason: '叠加 +4 转移压力' };
    }
    if (action.action === 'challenge') {
      const challengedPlayerId = state.pendingChallenge?.challengedPlayerId;
      const challengedHandCount = challengedPlayerId ? this.publicHandCount(state, challengedPlayerId) : 0;
      const score = challengedHandCount >= 4 ? 300 : 120;
      return { action, score, reason: '根据对方手牌数评估 +4 质疑' };
    }
    const penalty = getHand(state, playerId).length <= 2 ? -500 : -150;
    return { action, score: penalty, reason: '接受 +4 摸牌' };
  }

  private shouldAvoidBadPlay(state: GameState, playerId: PlayerId): boolean {
    const nextPlayerId = this.turns.nextPlayerId(state, playerId);
    return this.publicHandCount(state, nextPlayerId) <= 1;
  }

  private publicHandCount(state: GameState, playerId: PlayerId): number {
    return state.players.find((player) => player.id === playerId)?.handCount ?? 0;
  }
}
