import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { cloneGameState, removeCardsFromHand, syncHandCounts } from '../../utils/state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class SameColorDumpHandler implements CardEffectHandler {
  readonly type = 'same_color_dump' as const;

  resolve(ctx: RuleContext, _card: Card): EffectResult {
    const next = cloneGameState(ctx.state);
    const hand = next.hands[ctx.playerId] ?? [];
    const sameColorIds = hand.filter((card) => card.color === ctx.state.currentColor).map((card) => card.id);
    const { removed, rest } = removeCardsFromHand(hand, sameColorIds);
    next.hands[ctx.playerId] = rest;
    next.discardPile.push(...removed);

    return {
      state: syncHandCounts(next),
      events: removed.length
        ? [{ type: 'effect_resolved', effectType: 'same_color_dump', targetPlayerIds: [ctx.playerId] }]
        : [],
      nextTurnPolicy: { type: 'normal' }
    };
  }
}
