import type { GameState } from '@shared/domain/game-state.js';

export interface GameStateRepository {
  get(roomId: string): Promise<GameState | null>;
  save(roomId: string, state: GameState): Promise<void>;
  delete(roomId: string): Promise<void>;
}

export class InMemoryGameStateRepository implements GameStateRepository {
  private readonly states = new Map<string, GameState>();

  async get(roomId: string): Promise<GameState | null> {
    return this.states.get(roomId) ?? null;
  }

  async save(roomId: string, state: GameState): Promise<void> {
    this.states.set(roomId, state);
  }

  async delete(roomId: string): Promise<void> {
    this.states.delete(roomId);
  }
}
