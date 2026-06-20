import type { RoomStateMessage } from '@shared/index.js';

export type ClientRoomState = RoomStateMessage['data'];

export class RoomStore {
  private roomValue: ClientRoomState | null = null;

  setRoom(room: ClientRoomState): void {
    this.roomValue = room;
  }

  clear(): void {
    this.roomValue = null;
  }

  get room(): ClientRoomState | null {
    return this.roomValue;
  }
}
