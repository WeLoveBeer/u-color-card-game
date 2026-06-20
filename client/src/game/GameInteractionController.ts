import type { CardId, PlayableColor, VisibleGameState } from '@shared/index.js';
import { ClientPlayableCardService } from '../domain/ClientPlayableCardService.js';
import { WsClient } from '../net/WsClient.js';

export type CardTapResult =
  | { type: 'rejected'; message: string }
  | { type: 'selected'; cardId: CardId }
  | { type: 'choose_color'; cardId: CardId }
  | { type: 'submitted'; seq: number; cardId: CardId };

export type DeckTapResult =
  | { type: 'rejected'; message: string }
  | { type: 'confirm_draw'; message: string }
  | { type: 'submitted'; seq: number };

export class GameInteractionController {
  private readonly playableCards = new ClientPlayableCardService();

  constructor(private readonly ws: WsClient) {}

  tapCard(state: VisibleGameState, playerId: string, cardId: CardId, selectedCardId: CardId | null = null): CardTapResult {
    if (state.currentPlayerId !== playerId) {
      return { type: 'rejected', message: '还没轮到你' };
    }
    const card = state.myHand.find((candidate) => candidate.id === cardId);
    if (!card) {
      return { type: 'rejected', message: '手牌不存在' };
    }
    const playableIds = this.playableCardIds(state);
    if (!playableIds.includes(cardId)) {
      return { type: 'rejected', message: '这张牌现在不能出' };
    }
    if (selectedCardId !== cardId) {
      return { type: 'selected', cardId };
    }
    if (card.type === 'wild_color' || card.type === 'wild_plus_four') {
      return { type: 'choose_color', cardId };
    }
    return { type: 'submitted', seq: this.playCard(state.roomId, cardId), cardId };
  }

  tapDeck(state: VisibleGameState, playerId: string, confirmed = false): DeckTapResult {
    if (state.currentPlayerId !== playerId) {
      return { type: 'rejected', message: '还没轮到你' };
    }
    if (!confirmed && this.playableCardIds(state).length > 0) {
      return { type: 'confirm_draw', message: '当前有可出牌，仍要摸牌吗？' };
    }
    return { type: 'submitted', seq: this.drawCard(state.roomId) };
  }

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

  private playableCardIds(state: VisibleGameState): CardId[] {
    return this.playableCards.getPlayableCards(state).map((card) => card.id);
  }
}
