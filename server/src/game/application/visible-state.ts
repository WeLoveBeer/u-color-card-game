import type { Card } from '@shared/domain/card.js';
import type { GameState, PlayerId } from '@shared/domain/game-state.js';
import type { VisibleGameState } from '@shared/protocol/ws-server-events.js';

export function toVisibleGameState(state: GameState, viewerId: PlayerId): VisibleGameState {
  const discardTop = state.discardPile[state.discardPile.length - 1] as Card;
  return {
    roomId: state.roomId,
    gameId: state.gameId,
    status: state.status,
    players: state.players.map((player) => ({
      ...player,
      handCount: state.hands[player.id]?.length ?? player.handCount
    })),
    currentPlayerId: state.currentPlayerId,
    direction: state.direction,
    currentColor: state.currentColor,
    discardTop,
    myHand: state.hands[viewerId] ?? [],
    deckCount: state.deck.length,
    pendingDrawCount: state.pendingDrawCount,
    pendingChallenge: state.pendingChallenge ?? null,
    turnDeadline: state.turnDeadline,
    stateVersion: state.actionSeq
  };
}
