import type { Card, PlayerId, VisibleGameState } from '@shared/index.js';
import { ClientPlayableCardService } from '../domain/ClientPlayableCardService.js';

export class GameStore {
  private stateValue: VisibleGameState | null = null;
  private readonly playable = new ClientPlayableCardService();

  setState(state: VisibleGameState): void {
    this.stateValue = state;
  }

  markPlayerOffline(playerId: PlayerId, autoPlayAt: number): void {
    this.patchPlayer(playerId, { online: false, autoPlayAt, disconnectAt: Date.now() });
  }

  markPlayerAutoPlaying(playerId: PlayerId): void {
    this.patchPlayer(playerId, { isAutoPlaying: true });
  }

  markPlayerReconnected(playerId: PlayerId): void {
    this.patchPlayer(playerId, { online: true, isAutoPlaying: false, disconnectAt: null, autoPlayAt: null });
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

  private patchPlayer(playerId: PlayerId, patch: Partial<VisibleGameState['players'][number]>): void {
    if (!this.stateValue) {
      return;
    }
    this.stateValue = {
      ...this.stateValue,
      players: this.stateValue.players.map((player) => (player.id === playerId ? { ...player, ...patch } : player))
    };
  }
}
