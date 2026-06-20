import type { GameState, PlayerId } from '@shared/domain/game-state.js';

export class TurnResolver {
  nextPlayerId(state: GameState, fromPlayerId = state.currentPlayerId, steps = 1): PlayerId {
    const ordered = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
    const index = ordered.findIndex((player) => player.id === fromPlayerId);
    if (index < 0) {
      throw new Error(`player not found: ${fromPlayerId}`);
    }

    const offset = state.direction * steps;
    const nextIndex = (index + offset + ordered.length * 10) % ordered.length;
    return ordered[nextIndex].id;
  }

  nextAfterSkip(state: GameState, skippedPlayerId: PlayerId): PlayerId {
    return this.nextPlayerId(state, skippedPlayerId, 1);
  }
}
