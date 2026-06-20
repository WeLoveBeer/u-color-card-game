import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { TurnResolver } from '../../turn/turn-resolver.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class SkipHandler implements CardEffectHandler {
  readonly type = 'skip' as const;
  private readonly turns = new TurnResolver();

  resolve(ctx: RuleContext, _card: Card): EffectResult {
    const targetPlayerId = this.turns.nextPlayerId(ctx.state);
    return {
      state: ctx.state,
      events: [{ type: 'effect_resolved', effectType: 'skip', targetPlayerIds: [targetPlayerId] }],
      nextTurnPolicy: { type: 'skip', targetPlayerId }
    };
  }
}
