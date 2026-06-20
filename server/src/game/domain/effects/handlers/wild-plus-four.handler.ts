import type { Card } from '@shared/domain/card.js';
import type { RuleContext } from '@shared/domain/game-state.js';
import { DeckResolver } from '../../deck/deck-resolver.js';
import { TurnResolver } from '../../turn/turn-resolver.js';
import { cloneGameState, getHand, hasColorCard, syncHandCounts } from '../../utils/state.js';
import type { CardEffectHandler, EffectResult } from '../effect-handler.js';

export class WildPlusFourHandler implements CardEffectHandler {
  readonly type = 'wild_plus_four' as const;
  private readonly deck = new DeckResolver();
  private readonly turns = new TurnResolver();

  resolve(ctx: RuleContext, card: Card): EffectResult {
    const targetPlayerId = this.turns.nextPlayerId(ctx.state);
    const chooseColor = ctx.chooseColor;
    const previousColor = ctx.state.currentColor === 'wild' ? undefined : ctx.state.currentColor;

    let next = cloneGameState(ctx.state);
    if (chooseColor) {
      next.currentColor = chooseColor;
    }

    if (ctx.state.ruleConfig.plusFourChallenge && previousColor) {
      next.pendingChallenge = {
        challengerId: targetPlayerId,
        challengedPlayerId: ctx.playerId,
        cardId: card.id,
        previousColor
      };
      const targetHand = getHand(next, targetPlayerId);
      const canStack = next.ruleConfig.plusFourStack && targetHand.some((item) => item.type === 'wild_plus_four');
      return {
        state: next,
        events: [
          ...(chooseColor ? [{ type: 'color_changed' as const, playerId: ctx.playerId, color: chooseColor, source: card.type }] : []),
          {
            type: 'plus_four_response_required',
            targetPlayerId,
            challengedPlayerId: ctx.playerId,
            chooseColor: chooseColor ?? 'red',
            options: canStack ? ['stack_plus_four', 'challenge'] : ['challenge', 'draw']
          }
        ],
        nextTurnPolicy: { type: 'wait_for_response', targetPlayerId }
      };
    }

    let drawn;
    ({ state: next, cards: drawn } = this.deck.draw(next, 4));
    next.hands[targetPlayerId] = [...(next.hands[targetPlayerId] ?? []), ...drawn];
    next = syncHandCounts(next);
    return {
      state: next,
      events: [
        ...(chooseColor ? [{ type: 'color_changed' as const, playerId: ctx.playerId, color: chooseColor, source: card.type }] : []),
        { type: 'effect_resolved', effectType: 'wild_plus_four', targetPlayerIds: [targetPlayerId] },
        { type: 'card_drawn', playerId: targetPlayerId, count: drawn.length, drawReason: 'wild_plus_four' }
      ],
      nextTurnPolicy: { type: 'skip', targetPlayerId }
    };
  }

  static challengeWouldSucceed(state: RuleContext['state']): boolean {
    const challenge = state.pendingChallenge;
    if (!challenge) {
      return false;
    }
    return hasColorCard(getHand(state, challenge.challengedPlayerId), challenge.previousColor);
  }
}
