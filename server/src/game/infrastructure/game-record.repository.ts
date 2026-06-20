import type { DomainEvent, GameState } from '@shared/domain/game-state.js';

export type GameActionLog = {
  gameId?: string;
  roomId: string;
  playerId: string;
  actionType: string;
  actionPayload: unknown;
  stateVersion: number;
  events: DomainEvent[];
};

export interface GameRecordRepository {
  appendAction(log: GameActionLog): Promise<void>;
  saveFinishedGame(state: GameState): Promise<void>;
}

export class InMemoryGameRecordRepository implements GameRecordRepository {
  readonly actions: GameActionLog[] = [];
  readonly finishedGames: GameState[] = [];

  async appendAction(log: GameActionLog): Promise<void> {
    this.actions.push(log);
  }

  async saveFinishedGame(state: GameState): Promise<void> {
    this.finishedGames.push(state);
  }
}
