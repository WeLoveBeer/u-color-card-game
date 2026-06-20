import type { RoomStateMessage } from '@shared/index.js';

export type ClientRoomState = RoomStateMessage['data'];

export class RoomStore {
  private roomValue: ClientRoomState | null = null;

  setRoom(room: ClientRoomState): void {
    this.roomValue = room;
  }

  markPlayerOffline(playerId: string, autoPlayAt: number): void {
    this.patchPlayer(playerId, { online: false, autoPlayAt, disconnectAt: Date.now() });
  }

  markPlayerAutoPlaying(playerId: string): void {
    this.patchPlayer(playerId, { isAutoPlaying: true });
  }

  markPlayerReconnected(playerId: string): void {
    this.patchPlayer(playerId, { online: true, isAutoPlaying: false, disconnectAt: null, autoPlayAt: null });
  }

  clear(): void {
    this.roomValue = null;
  }

  get room(): ClientRoomState | null {
    return this.roomValue;
  }

  private patchPlayer(playerId: string, patch: Partial<ClientRoomState['players'][number]>): void {
    if (!this.roomValue) {
      return;
    }
    this.roomValue = {
      ...this.roomValue,
      players: this.roomValue.players.map((player) => (player.id === playerId ? { ...player, ...patch } : player))
    };
  }
}
