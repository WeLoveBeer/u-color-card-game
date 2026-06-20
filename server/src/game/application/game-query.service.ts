import type { PlayerId } from '@shared/domain/game-state.js';
import type { VisibleGameState } from '@shared/protocol/ws-server-events.js';
import type { GameStateRepository } from '../infrastructure/game-state.repository.js';
import { InMemoryGameStateRepository } from '../infrastructure/game-state.repository.js';
import { toVisibleGameState } from './visible-state.js';

export class GameQueryService {
  constructor(private readonly states: GameStateRepository = new InMemoryGameStateRepository()) {}

  async getVisibleState(roomId: string, viewerId: PlayerId): Promise<VisibleGameState | null> {
    const state = await this.states.get(roomId);
    return state ? toVisibleGameState(state, viewerId) : null;
  }
}
