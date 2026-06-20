import type { Card, CardColor, CardType, PlayableColor } from '@shared/domain/card.js';
import { PLAYABLE_COLORS } from '@shared/domain/card.js';
import type { RuleConfig } from '@shared/domain/rule-config.js';
import type { GameState } from '@shared/domain/game-state.js';
import { cloneGameState } from '../utils/state.js';
import type { RandomSource } from './shuffle.service.js';
import { MathRandomSource, shuffle } from './shuffle.service.js';

export class DeckResolver {
  createDeck(config: RuleConfig): Card[] {
    const cards: Card[] = [];
    let seq = 1;
    const add = (color: CardColor, type: CardType, value?: string, count = 1) => {
      for (let i = 0; i < count; i += 1) {
        cards.push({ id: `c_${seq++}`, color, type, value });
      }
    };

    for (const color of PLAYABLE_COLORS) {
      for (let value = 0; value <= 9; value += 1) {
        add(color, 'number', String(value), value === 0 ? 1 : 2);
      }
      add(color, 'skip', 'skip', 2);
      add(color, 'reverse', 'reverse', 2);
      add(color, 'plus_two', 'plus_two', 2);
      if (config.sameColorDump || config.specialPacks.includes('same_color_dump')) {
        add(color, 'same_color_dump', 'same_color_dump', 1);
      }
    }

    add('wild', 'wild_color', 'wild_color', 4);
    if (config.plusFourEnabled) {
      add('wild', 'wild_plus_four', 'wild_plus_four', 4);
    }

    return cards;
  }

  shuffleDeck(deck: Card[], random: RandomSource = new MathRandomSource()): Card[] {
    return shuffle(deck, random);
  }

  deal(deck: Card[], playerIds: string[], initialCards: number): { deck: Card[]; hands: Record<string, Card[]> } {
    const remaining = [...deck];
    const hands: Record<string, Card[]> = Object.fromEntries(playerIds.map((id) => [id, []]));

    for (let round = 0; round < initialCards; round += 1) {
      for (const playerId of playerIds) {
        const card = remaining.shift();
        if (card) {
          hands[playerId].push(card);
        }
      }
    }

    return { deck: remaining, hands };
  }

  draw(state: GameState, count: number): { state: GameState; cards: Card[] } {
    let next = cloneGameState(state);
    const cards: Card[] = [];

    for (let i = 0; i < count; i += 1) {
      if (next.deck.length === 0) {
        next = this.reshuffleDiscardIntoDeck(next);
      }
      const card = next.deck.shift();
      if (card) {
        cards.push(card);
      }
    }

    return { state: next, cards };
  }

  takeStartingDiscard(deck: Card[]): { deck: Card[]; discardTop: Card } {
    const next = [...deck];
    const index = next.findIndex((card) => card.type === 'number');
    const [discardTop] = next.splice(index >= 0 ? index : 0, 1);
    return { deck: next, discardTop };
  }

  private reshuffleDiscardIntoDeck(state: GameState): GameState {
    const next = cloneGameState(state);
    const top = next.discardPile.pop();
    const recyclable = next.discardPile;
    next.deck = shuffle(recyclable, new MathRandomSource());
    next.discardPile = top ? [top] : [];
    return next;
  }
}
