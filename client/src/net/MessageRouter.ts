import type { WsServerMessage } from '@shared/index.js';
import { GameStore } from '../state/GameStore.js';
import { RoomStore } from '../state/RoomStore.js';

export class MessageRouter {
  constructor(
    private readonly roomStore: RoomStore,
    private readonly gameStore: GameStore,
    private readonly animationSink: { enqueue(message: WsServerMessage): void }
  ) {}

  route(message: WsServerMessage): void {
    if (message.type === 'room_state') {
      this.roomStore.setRoom(message.data);
      return;
    }
    if (message.type === 'game_start') {
      this.gameStore.setState(message.data.state);
      this.animationSink.enqueue(message);
      return;
    }
    if ('data' in message && message.data && typeof message.data === 'object' && 'state' in message.data) {
      this.gameStore.setState(message.data.state as never);
    }
    this.animationSink.enqueue(message);
  }
}
