import type { CardId, PlayerId, RoomId } from '../domain/game-state.js';
import type { PlayableColor } from '../domain/card.js';

export type WsClientEnvelope<T extends string, D> = {
  seq: number;
  type: T;
  data: D;
};

export type JoinRoomMessage = WsClientEnvelope<'join_room', { roomId: RoomId }>;
export type LeaveRoomMessage = WsClientEnvelope<'leave_room', { roomId: RoomId }>;
export type ReadyMessage = WsClientEnvelope<'ready', { roomId: RoomId; ready: boolean }>;
export type StartGameMessage = WsClientEnvelope<'start_game', { roomId: RoomId }>;
export type PlayCardMessage = WsClientEnvelope<
  'play_card',
  { roomId: RoomId; cardIds: CardId[]; chooseColor?: PlayableColor }
>;
export type DrawCardMessage = WsClientEnvelope<'draw_card', { roomId: RoomId }>;
export type PassTurnMessage = WsClientEnvelope<'pass_turn', { roomId: RoomId }>;
export type RespondPlusFourMessage = WsClientEnvelope<
  'respond_plus_four',
  {
    roomId: RoomId;
    action: 'draw' | 'challenge' | 'stack_plus_four';
    cardId?: CardId;
    chooseColor?: PlayableColor;
  }
>;
export type CallUMessage = WsClientEnvelope<'call_u', { roomId: RoomId }>;
export type CatchMissedCallMessage = WsClientEnvelope<
  'catch_missed_call',
  { roomId: RoomId; targetPlayerId: PlayerId }
>;
export type ReconnectMessage = WsClientEnvelope<'reconnect', { roomId?: RoomId; lastSeq?: number }>;

export type WsClientMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | ReadyMessage
  | StartGameMessage
  | PlayCardMessage
  | DrawCardMessage
  | PassTurnMessage
  | RespondPlusFourMessage
  | CallUMessage
  | CatchMissedCallMessage
  | ReconnectMessage;
