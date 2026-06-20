import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class NumberHandler implements CardEffectHandler {
  readonly type = 'number' as const;

  resolve(ctx: RuleContext, _card: Card): EffectResult {
    return { state: ctx.state, events: [], nextTurnPolicy: { type: 'normal' } };
  }
}
