import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { cloneGameState } from '../../utils/state.js';
import { TurnResolver } from '../../turn/turn-resolver.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class ReverseHandler implements CardEffectHandler {
  readonly type = 'reverse' as const;
  private readonly turns = new TurnResolver();

  resolve(ctx: RuleContext, _card: Card): EffectResult {
    const next = cloneGameState(ctx.state);

    if (next.players.length === 2) {
      const targetPlayerId = this.turns.nextPlayerId(next);
      return {
        state: next,
        events: [
          { type: 'direction_changed', playerId: ctx.playerId, direction: next.direction, source: 'reverse' },
          { type: 'effect_resolved', effectType: 'reverse', targetPlayerIds: [targetPlayerId] }
        ],
        nextTurnPolicy: { type: 'skip', targetPlayerId }
      };
    }

    next.direction = next.direction === 1 ? -1 : 1;
    return {
      state: next,
      events: [{ type: 'direction_changed', playerId: ctx.playerId, direction: next.direction, source: 'reverse' }],
      nextTurnPolicy: { type: 'normal' }
    };
  }
}
