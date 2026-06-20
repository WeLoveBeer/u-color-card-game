import type { Card, CardType } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class PlaceholderHandler implements CardEffectHandler {
  constructor(readonly type: CardType) {}

  resolve(ctx: RuleContext, card: Card): EffectResult {
    return {
      state: ctx.state,
      events: [{ type: 'effect_resolved', effectType: card.type, targetPlayerIds: [] }],
      nextTurnPolicy: { type: 'normal' }
    };
  }
}
