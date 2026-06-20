import type { Card } from '@shared/index.js';

export type CardViewModel = {
  id: string;
  assetKey: string;
  playable: boolean;
  selected: boolean;
};

export class CardView {
  build(card: Card, playable: boolean, selected = false): CardViewModel {
    const assetKey =
      card.type === 'number'
        ? `card.${card.color}.${card.value}`
        : card.color === 'wild'
          ? card.type === 'wild_plus_four'
            ? 'card.wild.plus4'
            : 'card.wild.color'
          : `card.${card.color}.${card.type === 'plus_two' ? 'plus2' : card.type}`;
    return { id: card.id, assetKey, playable, selected };
  }
}
