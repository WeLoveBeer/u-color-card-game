import type { Card, VisibleGameState } from '@shared/index.js';

export class ClientPlayableCardService {
  getPlayableCards(state: VisibleGameState): Card[] {
    return state.myHand.filter((card) => this.canPlay(state, card));
  }

  canPlay(state: VisibleGameState, card: Card): boolean {
    if (state.pendingDrawCount > 0) {
      return card.type === 'plus_two' || card.type === 'wild_plus_four';
    }
    return (
      card.color === state.currentColor ||
      (card.type === 'number' && card.value === state.discardTop.value) ||
      (card.type !== 'number' && card.type === state.discardTop.type) ||
      card.type === 'wild_color' ||
      card.type === 'wild_plus_four'
    );
  }
}
