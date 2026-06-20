import type { Card, PlayerId, VisibleGameState } from '@shared/index.js';
import { ClientPlayableCardService } from '../domain/ClientPlayableCardService.js';

export class GameStore {
  private stateValue: VisibleGameState | null = null;
  private readonly playable = new ClientPlayableCardService();

  setState(state: VisibleGameState): void {
    this.stateValue = state;
  }

  clear(): void {
    this.stateValue = null;
  }

  get state(): VisibleGameState | null {
    return this.stateValue;
  }

  get myHand(): Card[] {
    return this.stateValue?.myHand ?? [];
  }

  isMyTurn(playerId: PlayerId): boolean {
    return this.stateValue?.currentPlayerId === playerId;
  }

  playableCardIds(): string[] {
    if (!this.stateValue) {
      return [];
    }
    return this.playable.getPlayableCards(this.stateValue).map((card) => card.id);
  }
}
