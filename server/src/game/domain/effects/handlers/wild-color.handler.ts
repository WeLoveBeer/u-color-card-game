import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { cloneGameState } from '../../utils/state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class WildColorHandler implements CardEffectHandler {
  readonly type = 'wild_color' as const;

  resolve(ctx: RuleContext, card: Card): EffectResult {
    if (!ctx.chooseColor) {
      return { state: ctx.state, events: [], nextTurnPolicy: { type: 'normal' } };
    }
    const next = cloneGameState(ctx.state);
    next.currentColor = ctx.chooseColor;
    return {
      state: next,
      events: [{ type: 'color_changed', playerId: ctx.playerId, color: ctx.chooseColor, source: card.type }],
      nextTurnPolicy: { type: 'normal' }
    };
  }
}
