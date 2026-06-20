import type { Card, CardColor, CardType, PlayableColor } from './card.js';
import type { RuleConfig } from './rule-config.js';

export type PlayerId = string;
export type RoomId = string;
export type GameId = string;
export type CardId = string;

export type PlayerState = {
  id: PlayerId;
  seatIndex: number;
  handCount: number;
  online: boolean;
  isAi: boolean;
  isAutoPlaying: boolean;
  disconnectAt?: number | null;
  autoPlayAt?: number | null;
};

export type PendingChallenge = {
  challengerId: PlayerId;
  challengedPlayerId: PlayerId;
  cardId: CardId;
  previousColor: PlayableColor;
};

export type MissedCallWindow = {
  targetPlayerId: PlayerId;
  openedAtActionSeq: number;
  closesAfterPlayerId: PlayerId;
};

export type GameState = {
  roomId: RoomId;
  gameId: GameId;
  status: 'waiting' | 'playing' | 'finished';
  ruleConfig: RuleConfig;
  players: PlayerState[];
  deck: Card[];
  discardPile: Card[];
  hands: Record<PlayerId, Card[]>;
  currentPlayerId: PlayerId;
  direction: 1 | -1;
  currentColor: CardColor;
  pendingDrawCount: number;
  pendingDrawSource?: 'plus_two' | 'wild_plus_four';
  pendingChallenge?: PendingChallenge;
  calledUThisTurn: Record<PlayerId, boolean>;
  missedCallWindow?: MissedCallWindow;
  turnDeadline: number;
  seedHash: string;
  actionSeq: number;
};

export type Ranking = {
  playerId: PlayerId;
  rank: number;
  remainCardCount: number;
  score: number;
};

export type CoinDelta = {
  playerId: PlayerId;
  coinDelta: number;
  coinAfter: number;
};

export type DrawReason =
  | 'normal'
  | 'plus_two'
  | 'wild_plus_four'
  | 'challenge_success'
  | 'challenge_failed'
  | 'missed_call_penalty'
  | 'timeout';

export type PlusFourResponseOption = 'draw' | 'challenge' | 'stack_plus_four';

export type GameErrorCode =
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_FOUND'
  | 'ILLEGAL_CARD'
  | 'COLOR_REQUIRED'
  | 'CHALLENGE_NOT_ALLOWED'
  | 'CHALLENGE_REQUIRED'
  | 'CATCH_NOT_ALLOWED'
  | 'ACTION_TIMEOUT'
  | 'GAME_NOT_STARTED';

export type RuleContext = {
  state: GameState;
  playerId: PlayerId;
  card?: Card;
  chooseColor?: PlayableColor;
};

export type AiHint = {
  pressureScore?: number;
  colorPreference?: Partial<Record<PlayableColor, number>>;
  preservesTurn?: boolean;
};

export type NextTurnPolicy =
  | { type: 'normal' }
  | { type: 'skip'; targetPlayerId: PlayerId }
  | { type: 'wait_for_response'; targetPlayerId: PlayerId }
  | { type: 'game_over' };

export type DomainEvent =
  | { type: 'card_played'; playerId: PlayerId; cardIds: CardId[]; publicCards: Card[] }
  | { type: 'card_drawn'; playerId: PlayerId; count: number; drawReason: DrawReason }
  | { type: 'turn_changed'; currentPlayerId: PlayerId }
  | { type: 'effect_resolved'; effectType: CardType; targetPlayerIds: PlayerId[] }
  | { type: 'color_changed'; playerId: PlayerId; color: PlayableColor; source: CardType }
  | { type: 'direction_changed'; playerId: PlayerId; direction: 1 | -1; source: 'reverse' }
  | {
      type: 'plus_four_response_required';
      targetPlayerId: PlayerId;
      challengedPlayerId: PlayerId;
      chooseColor: PlayableColor;
      options: PlusFourResponseOption[];
    }
  | {
      type: 'plus_four_challenge_result';
      success: boolean;
      challengerId: PlayerId;
      challengedPlayerId: PlayerId;
      drawPlayerId: PlayerId;
      drawCount: number;
    }
  | { type: 'player_called_u'; playerId: PlayerId }
  | { type: 'missed_call_window_opened'; targetPlayerId: PlayerId; closesAfterPlayerId: PlayerId }
  | { type: 'missed_call_caught'; catcherId: PlayerId; targetPlayerId: PlayerId; penaltyCards: number }
  | { type: 'missed_call_window_closed'; targetPlayerId: PlayerId }
  | { type: 'game_over'; winnerId: PlayerId; rankings: Ranking[]; coinDeltas: CoinDelta[] };

export type GameResult = {
  ok: boolean;
  state: GameState;
  events: DomainEvent[];
  errorCode?: GameErrorCode;
};
