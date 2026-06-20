import type { Card, CardType, PlayableColor } from '../domain/card.js';
import type {
  CoinDelta,
  DrawReason,
  PlayerId,
  PlayerState,
  PlusFourResponseOption,
  Ranking,
  RoomId
} from '../domain/game-state.js';
import type { RuleConfig } from '../domain/rule-config.js';
import type { ApiError } from './errors.js';

export type PublicRoomPlayer = PlayerState & {
  nickname?: string;
  avatar?: string;
  ready?: boolean;
};

export type VisibleGameState = {
  roomId: RoomId;
  gameId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerState[];
  currentPlayerId: PlayerId;
  direction: 1 | -1;
  currentColor: PlayableColor | 'wild';
  discardTop: Card;
  myHand: Card[];
  deckCount: number;
  pendingDrawCount: number;
  pendingChallenge: unknown | null;
  turnDeadline: number;
  turnSeq: number;
  stateVersion: number;
};

export type WsServerEnvelope<T extends string, D> = {
  seq?: number;
  type: T;
  serverTime: number;
  data: D;
};

export type RoomStateMessage = WsServerEnvelope<
  'room_state',
  {
    roomId: RoomId;
    ownerId: PlayerId;
    status: 'waiting' | 'playing' | 'finished';
    config: RuleConfig;
    players: PublicRoomPlayer[];
  }
>;

export type GameStartMessage = WsServerEnvelope<'game_start', { roomId: RoomId; gameId: string; state: VisibleGameState }>;
export type GameStateMessage = WsServerEnvelope<'game_state', VisibleGameState>;
export type CardPlayedMessage = WsServerEnvelope<
  'card_played',
  {
    playerId: PlayerId;
    cardIds: string[];
    publicCards: Card[];
    effects: Array<{ type: CardType; targetPlayerId?: PlayerId; targetPlayerIds?: PlayerId[] }>;
    state?: VisibleGameState;
  }
>;
export type CardDrawnMessage = WsServerEnvelope<
  'card_drawn',
  { playerId: PlayerId; count: number; drawReason: DrawReason; state?: VisibleGameState }
>;
export type ColorChangedMessage = WsServerEnvelope<
  'color_changed',
  { roomId: RoomId; color: PlayableColor; source: CardType; playerId: PlayerId; state?: VisibleGameState }
>;
export type DirectionChangedMessage = WsServerEnvelope<
  'direction_changed',
  { roomId: RoomId; direction: 1 | -1; source: 'reverse'; playerId: PlayerId; state?: VisibleGameState }
>;
export type PlusFourResponseRequiredMessage = WsServerEnvelope<
  'plus_four_response_required',
  {
    roomId: RoomId;
    targetPlayerId: PlayerId;
    challengedPlayerId: PlayerId;
    chooseColor: PlayableColor;
    options: PlusFourResponseOption[];
    turnDeadline: number;
  }
>;
export type PlusFourChallengeResultMessage = WsServerEnvelope<
  'plus_four_challenge_result',
  {
    success: boolean;
    challengerId: PlayerId;
    challengedPlayerId: PlayerId;
    drawPlayerId: PlayerId;
    drawCount: number;
    state?: VisibleGameState;
  }
>;
export type TurnChangedMessage = WsServerEnvelope<
  'turn_changed',
  { currentPlayerId: PlayerId; turnDeadline: number; turnSeq: number; state?: VisibleGameState }
>;
export type GameOverMessage = WsServerEnvelope<
  'game_over',
  {
    gameId: string;
    winnerId: PlayerId;
    rankings: Ranking[];
    seedHash: string;
    rewards: unknown[];
    coinDeltas: CoinDelta[];
  }
>;
export type PlayerCalledUMessage = WsServerEnvelope<'player_called_u', { playerId: PlayerId }>;
export type MissedCallWindowOpenedMessage = WsServerEnvelope<
  'missed_call_window_opened',
  { targetPlayerId: PlayerId; closesAfterPlayerId: PlayerId }
>;
export type MissedCallCaughtMessage = WsServerEnvelope<
  'missed_call_caught',
  { catcherId: PlayerId; targetPlayerId: PlayerId; penaltyCards: number }
>;
export type MissedCallWindowClosedMessage = WsServerEnvelope<'missed_call_window_closed', { targetPlayerId: PlayerId }>;
export type PlayerOfflineMessage = WsServerEnvelope<'player_offline', { roomId: RoomId; playerId: PlayerId; autoPlayAt: number }>;
export type PlayerAutoPlayStartedMessage = WsServerEnvelope<'player_auto_play_started', { roomId: RoomId; playerId: PlayerId }>;
export type PlayerReconnectedMessage = WsServerEnvelope<'player_reconnected', { roomId: RoomId; playerId: PlayerId }>;
export type ErrorMessage = {
  seq?: number;
  type: 'error';
  serverTime: number;
  error: ApiError;
};

export type WsServerMessage =
  | RoomStateMessage
  | GameStartMessage
  | GameStateMessage
  | CardPlayedMessage
  | CardDrawnMessage
  | ColorChangedMessage
  | DirectionChangedMessage
  | PlusFourResponseRequiredMessage
  | PlusFourChallengeResultMessage
  | TurnChangedMessage
  | GameOverMessage
  | PlayerCalledUMessage
  | MissedCallWindowOpenedMessage
  | MissedCallCaughtMessage
  | MissedCallWindowClosedMessage
  | PlayerOfflineMessage
  | PlayerAutoPlayStartedMessage
  | PlayerReconnectedMessage
  | ErrorMessage;
