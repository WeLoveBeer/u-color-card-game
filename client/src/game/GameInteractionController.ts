import type { CardId, PlayableColor } from '@shared/index.js';
import { WsClient } from '../net/WsClient.js';

export class GameInteractionController {
  constructor(private readonly ws: WsClient) {}

  playCard(roomId: string, cardId: CardId, chooseColor?: PlayableColor): number {
    return this.ws.send({ type: 'play_card', data: { roomId, cardIds: [cardId], chooseColor } });
  }

  drawCard(roomId: string): number {
    return this.ws.send({ type: 'draw_card', data: { roomId } });
  }

  passTurn(roomId: string): number {
    return this.ws.send({ type: 'pass_turn', data: { roomId } });
  }

  callU(roomId: string): number {
    return this.ws.send({ type: 'call_u', data: { roomId } });
  }

  catchMissedCall(roomId: string, targetPlayerId: string): number {
    return this.ws.send({ type: 'catch_missed_call', data: { roomId, targetPlayerId } });
  }
}
