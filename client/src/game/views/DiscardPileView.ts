import type { Card } from '@shared/index.js';
import { CardView } from './CardView.js';

export class DiscardPileView {
  private readonly cardView = new CardView();

  build(discardTop: Card) {
    return this.cardView.build(discardTop, false);
  }
}
