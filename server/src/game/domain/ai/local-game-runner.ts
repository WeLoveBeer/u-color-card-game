import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { GameEngine } from '../game-engine.js';
import { AiPlayer } from './ai-player.js';
import type { AiAction } from './ai-action.types.js';

export type LocalGameRunResult = {
  state: GameState;
  turns: number;
  actions: Array<{ playerId: PlayerId; action: AiAction; ok: boolean }>;
};

export class LocalGameRunner {
  constructor(
    private readonly engine = new GameEngine(),
    private readonly ai = new AiPlayer()
  ) {}

  run(state: GameState, maxTurns = 500): LocalGameRunResult {
    let next = state;
    const actions: LocalGameRunResult['actions'] = [];

    for (let turn = 0; turn < maxTurns && next.status !== 'finished'; turn += 1) {
      const playerId = next.currentPlayerId;
      const action = this.ai.decideAction(next, playerId);
      const result = this.applyAction(next, playerId, action);
      actions.push({ playerId, action, ok: result.ok });
      next = result.state;

      // 喊 U 只是前置声明，不消耗回合；同一玩家继续让 AI 做真正行动。
      if (action.type === 'call_u') {
        const followUp = this.ai.decideAction(next, playerId);
        const followResult = this.applyAction(next, playerId, followUp);
        actions.push({ playerId, action: followUp, ok: followResult.ok });
        next = followResult.state;
      }
    }

    return { state: next, turns: actions.length, actions };
  }

  private applyAction(state: GameState, playerId: PlayerId, action: AiAction) {
    switch (action.type) {
      case 'play_card':
        return this.engine.playCards(state, playerId, action.cardIds, action.chooseColor);
      case 'draw_card':
        return this.engine.drawCard(state, playerId);
      case 'pass_turn':
        return this.engine.passTurn(state, playerId);
      case 'call_u':
        return this.engine.callU(state, playerId);
      case 'catch_missed_call':
        return this.engine.catchMissedCall(state, playerId, action.targetPlayerId);
      case 'plus_four_response':
        return this.engine.respondPlusFour(state, playerId, action.action, action.cardId, action.chooseColor);
      default:
        return this.engine.drawCard(state, playerId);
    }
  }
}
