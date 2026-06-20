import type { Card, PlayableColor } from '@shared/domain/card.js';
import type { GameErrorCode, GameState, PlayerId } from '@shared/domain/game-state.js';
import { getDiscardTop, getHand } from '../utils/state.js';

export type ValidationResult = { ok: true } | { ok: false; errorCode: GameErrorCode };

export class RuleValidator {
  validateTurn(state: GameState, playerId: PlayerId): ValidationResult {
    if (state.status !== 'playing') {
      return { ok: false, errorCode: 'GAME_NOT_STARTED' };
    }
    if (state.currentPlayerId !== playerId) {
      return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    }
    return { ok: true };
  }

  validatePlay(state: GameState, playerId: PlayerId, cardIds: string[], chooseColor?: PlayableColor): ValidationResult {
    const turn = this.validateTurn(state, playerId);
    if (!turn.ok) {
      return turn;
    }
    if (state.pendingChallenge) {
      return { ok: false, errorCode: 'CHALLENGE_REQUIRED' };
    }

    const hand = getHand(state, playerId);
    const cards = cardIds.map((id) => hand.find((card) => card.id === id));
    if (cards.some((card) => !card)) {
      return { ok: false, errorCode: 'CARD_NOT_FOUND' };
    }
    const playableCards = cards as Card[];
    if (playableCards.length !== 1) {
      return { ok: false, errorCode: 'ILLEGAL_CARD' };
    }

    const card = playableCards[0];
    if ((card.type === 'wild_color' || card.type === 'wild_plus_four') && !chooseColor) {
      return { ok: false, errorCode: 'COLOR_REQUIRED' };
    }
    if (card.type === 'same_color_dump' && !state.ruleConfig.sameColorDump) {
      return { ok: false, errorCode: 'ILLEGAL_CARD' };
    }
    if (!this.canPlayCard(state, card)) {
      return { ok: false, errorCode: 'ILLEGAL_CARD' };
    }
    return { ok: true };
  }

  canPlayCard(state: GameState, card: Card): boolean {
    if (state.pendingDrawCount > 0) {
      return this.canStackDraw(state, card);
    }

    const top = getDiscardTop(state);
    return (
      card.color === state.currentColor ||
      (card.type === 'number' && card.value === top.value) ||
      (card.type !== 'number' && card.type === top.type) ||
      card.type === 'wild_color' ||
      (card.type === 'wild_plus_four' && state.ruleConfig.plusFourEnabled)
    );
  }

  validateCallU(state: GameState, playerId: PlayerId): ValidationResult {
    const turn = this.validateTurn(state, playerId);
    if (!turn.ok) {
      return turn;
    }
    if (!state.ruleConfig.callUPenalty || getHand(state, playerId).length !== 2) {
      return { ok: false, errorCode: 'ILLEGAL_CARD' };
    }
    return { ok: true };
  }

  validateCatchMissedCall(state: GameState, catcherId: PlayerId, targetPlayerId: PlayerId): ValidationResult {
    if (catcherId === targetPlayerId || state.missedCallWindow?.targetPlayerId !== targetPlayerId) {
      return { ok: false, errorCode: 'CATCH_NOT_ALLOWED' };
    }
    return { ok: true };
  }

  private canStackDraw(state: GameState, card: Card): boolean {
    if (state.pendingDrawSource === 'plus_two') {
      return state.ruleConfig.plusTwoStack && (card.type === 'plus_two' || card.type === 'wild_plus_four');
    }
    if (state.pendingDrawSource === 'wild_plus_four') {
      return state.ruleConfig.plusFourStack && card.type === 'wild_plus_four';
    }
    return false;
  }
}
