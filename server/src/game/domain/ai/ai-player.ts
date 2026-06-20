import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { AiActionGenerator } from './ai-action-generator.js';
import { AiScorer } from './ai-scorer.js';
import type { AiAction, ScoredAiAction } from './ai-action.types.js';

export class AiPlayer {
  constructor(
    private readonly generator = new AiActionGenerator(),
    private readonly scorer = new AiScorer()
  ) {}

  decide(state: GameState, playerId: PlayerId): ScoredAiAction {
    const actions = this.generator.enumerate(state, playerId);
    if (actions.length === 0) {
      return { action: { type: 'draw_card' }, score: -999, reason: '无合法动作时摸牌兜底' };
    }

    const scored = actions.map((action) => this.scorer.score(state, playerId, action));
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  decideAction(state: GameState, playerId: PlayerId): AiAction {
    return this.decide(state, playerId).action;
  }
}
