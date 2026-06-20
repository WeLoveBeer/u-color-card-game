import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { DeckResolver } from '../../deck/deck-resolver.js';
import { TurnResolver } from '../../turn/turn-resolver.js';
import { cloneGameState, syncHandCounts } from '../../utils/state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class PlusTwoHandler implements CardEffectHandler {
  readonly type = 'plus_two' as const;
  private readonly deck = new DeckResolver();
  private readonly turns = new TurnResolver();

  resolve(ctx: RuleContext, _card: Card): EffectResult {
    const targetPlayerId = this.turns.nextPlayerId(ctx.state);

    if (ctx.state.ruleConfig.plusTwoStack) {
      const next = cloneGameState(ctx.state);
      next.pendingDrawCount += 2;
      next.pendingDrawSource = 'plus_two';
      return {
        state: next,
        events: [{ type: 'effect_resolved', effectType: 'plus_two', targetPlayerIds: [targetPlayerId] }],
        nextTurnPolicy: { type: 'normal' }
      };
    }

    let { state, cards } = this.deck.draw(ctx.state, 2);
    state.hands[targetPlayerId] = [...(state.hands[targetPlayerId] ?? []), ...cards];
    state = syncHandCounts(state);
    return {
      state,
      events: [
        { type: 'effect_resolved', effectType: 'plus_two', targetPlayerIds: [targetPlayerId] },
        { type: 'card_drawn', playerId: targetPlayerId, count: cards.length, drawReason: 'plus_two' }
      ],
      nextTurnPolicy: { type: 'skip', targetPlayerId }
    };
  }
}
