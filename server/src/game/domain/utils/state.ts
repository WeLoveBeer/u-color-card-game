import type { Card, PlayableColor } from '@shared/domain/card.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    deck: state.deck.map((card) => ({ ...card })),
    discardPile: state.discardPile.map((card) => ({ ...card })),
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([playerId, hand]) => [playerId, hand.map((card) => ({ ...card }))])
    ),
    pendingChallenge: state.pendingChallenge ? { ...state.pendingChallenge } : undefined,
    calledUThisTurn: { ...state.calledUThisTurn },
    missedCallWindow: state.missedCallWindow ? { ...state.missedCallWindow } : undefined
  };
}

export function getHand(state: GameState, playerId: PlayerId): Card[] {
  return state.hands[playerId] ?? [];
}

export function syncHandCounts(state: GameState): GameState {
  const next = cloneGameState(state);
  next.players = next.players.map((player) => ({
    ...player,
    handCount: getHand(next, player.id).length
  }));
  return next;
}

export function getDiscardTop(state: GameState): Card {
  const top = state.discardPile[state.discardPile.length - 1];
  if (!top) {
    throw new Error('discard pile is empty');
  }
  return top;
}

export function removeCardsFromHand(hand: Card[], cardIds: string[]): { removed: Card[]; rest: Card[] } {
  const remainingIds = new Set(cardIds);
  const removed: Card[] = [];
  const rest: Card[] = [];

  for (const card of hand) {
    if (remainingIds.has(card.id)) {
      removed.push(card);
      remainingIds.delete(card.id);
    } else {
      rest.push(card);
    }
  }

  return { removed, rest };
}

export function hasColorCard(hand: Card[], color: PlayableColor): boolean {
  return hand.some((card) => card.color === color);
}

export function nextActionSeq(state: GameState): number {
  return state.actionSeq + 1;
}
