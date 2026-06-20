import type { DomainEvent, GameState, PlayerId } from '@shared/domain/game-state.js';
import type { WsServerMessage } from '@shared/protocol/ws-server-events.js';
import { toVisibleGameState } from './visible-state.js';

export class GameEventMapper {
  toMessages(state: GameState, viewerId: PlayerId, events: DomainEvent[], serverTime = Date.now()): WsServerMessage[] {
    const visibleState = toVisibleGameState(state, viewerId);
    return events.map((event) => {
      switch (event.type) {
        case 'card_played':
          return {
            type: 'card_played',
            serverTime,
            data: {
              playerId: event.playerId,
              cardIds: event.cardIds,
              publicCards: event.publicCards,
              effects: [],
              state: visibleState
            }
          };
        case 'card_drawn':
          return { type: 'card_drawn', serverTime, data: { ...event, state: visibleState } };
        case 'turn_changed':
          return {
            type: 'turn_changed',
            serverTime,
            data: { currentPlayerId: event.currentPlayerId, turnDeadline: state.turnDeadline, state: visibleState }
          };
        case 'color_changed':
          return { type: 'color_changed', serverTime, data: { roomId: state.roomId, ...event, state: visibleState } };
        case 'direction_changed':
          return { type: 'direction_changed', serverTime, data: { roomId: state.roomId, ...event, state: visibleState } };
        case 'plus_four_response_required':
          return {
            type: 'plus_four_response_required',
            serverTime,
            data: { roomId: state.roomId, ...event, turnDeadline: state.turnDeadline }
          };
        case 'plus_four_challenge_result':
          return { type: 'plus_four_challenge_result', serverTime, data: { ...event, state: visibleState } };
        case 'player_called_u':
          return { type: 'player_called_u', serverTime, data: { playerId: event.playerId } };
        case 'missed_call_window_opened':
          return { type: 'missed_call_window_opened', serverTime, data: event };
        case 'missed_call_caught':
          return { type: 'missed_call_caught', serverTime, data: event };
        case 'missed_call_window_closed':
          return { type: 'missed_call_window_closed', serverTime, data: event };
        case 'game_over':
          return {
            type: 'game_over',
            serverTime,
            data: {
              gameId: state.gameId,
              winnerId: event.winnerId,
              rankings: event.rankings,
              seedHash: state.seedHash,
              rewards: [],
              coinDeltas: event.coinDeltas
            }
          };
        case 'effect_resolved':
          return {
            type: 'card_played',
            serverTime,
            data: {
              playerId: viewerId,
              cardIds: [],
              publicCards: [],
              effects: [{ type: event.effectType, targetPlayerIds: event.targetPlayerIds }],
              state: visibleState
            }
          };
        default:
          return { type: 'game_state', serverTime, data: visibleState };
      }
    });
  }
}
