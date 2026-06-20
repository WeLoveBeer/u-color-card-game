import type { Card, PlayableColor } from '@shared/domain/card.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import { RuleValidator } from '../rules/rule-validator.js';
import { getHand } from '../utils/state.js';
import type { AiAction } from './ai-action.types.js';

export class AiActionGenerator {
  constructor(private readonly validator = new RuleValidator()) {}

  enumerate(state: GameState, playerId: PlayerId): AiAction[] {
    const actions: AiAction[] = [];

    if (state.missedCallWindow && state.missedCallWindow.targetPlayerId !== playerId) {
      actions.push({ type: 'catch_missed_call', targetPlayerId: state.missedCallWindow.targetPlayerId });
    }

    if (state.pendingChallenge?.challengerId === playerId) {
      actions.push(...this.enumeratePlusFourResponses(state, playerId));
      return actions;
    }

    if (state.currentPlayerId !== playerId || state.status !== 'playing') {
      return actions;
    }

    const hand = getHand(state, playerId);
    const playableCards = hand.filter((card) => this.validator.canPlayCard(state, card));

    if (state.ruleConfig.callUPenalty && hand.length === 2 && playableCards.length > 0 && !state.calledUThisTurn[playerId]) {
      actions.push({ type: 'call_u' });
    }

    for (const card of playableCards) {
      if (card.type === 'wild_color' || card.type === 'wild_plus_four') {
        actions.push({ type: 'play_card', cardIds: [card.id], chooseColor: this.chooseBestColor(hand, card) });
      } else {
        actions.push({ type: 'play_card', cardIds: [card.id] });
      }
    }

    actions.push({ type: 'draw_card' });
    return actions;
  }

  chooseBestColor(hand: Card[], excluding?: Card): PlayableColor {
    const counts: Record<PlayableColor, number> = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const card of hand) {
      if (excluding?.id === card.id || card.color === 'wild') {
        continue;
      }
      counts[card.color] += 1;
    }
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as PlayableColor) ?? 'red';
  }

  private enumeratePlusFourResponses(state: GameState, playerId: PlayerId): AiAction[] {
    const hand = getHand(state, playerId);
    const plusFour = hand.find((card) => card.type === 'wild_plus_four');
    const actions: AiAction[] = [];

    if (state.ruleConfig.plusFourStack && plusFour) {
      actions.push({
        type: 'plus_four_response',
        action: 'stack_plus_four',
        cardId: plusFour.id,
        chooseColor: this.chooseBestColor(hand, plusFour)
      });
    }
    if (state.ruleConfig.plusFourChallenge) {
      actions.push({ type: 'plus_four_response', action: 'challenge' });
    }
    if (!plusFour || !state.ruleConfig.plusFourStack) {
      actions.push({ type: 'plus_four_response', action: 'draw' });
    }
    return actions;
  }
}
