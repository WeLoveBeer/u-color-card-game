import type { Card } from '@shared/index.js';
import { CardView, type CardViewModel } from './CardView.js';

export class HandCardView {
  private readonly cardView = new CardView();

  build(hand: Card[], playableIds: string[], selectedId?: string): CardViewModel[] {
    return hand.map((card) => this.cardView.build(card, playableIds.includes(card.id), selectedId === card.id));
  }
}
