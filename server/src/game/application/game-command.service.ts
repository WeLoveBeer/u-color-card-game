import type { PlayableColor } from '@shared/domain/card.js';
import type { DomainEvent, GameResult, GameState, PlayerId } from '@shared/domain/game-state.js';
import type { RuleConfig } from '@shared/domain/rule-config.js';
import { GameEngine } from '../domain/game-engine.js';
import { AiPlayer } from '../domain/ai/ai-player.js';
import type { AiAction } from '../domain/ai/ai-action.types.js';
import type { GameRecordRepository } from '../infrastructure/game-record.repository.js';
import { InMemoryGameRecordRepository } from '../infrastructure/game-record.repository.js';
import type { GameStateRepository } from '../infrastructure/game-state.repository.js';
import { InMemoryGameStateRepository } from '../infrastructure/game-state.repository.js';
import type { RoomLock } from '../infrastructure/room-lock.js';
import { InMemoryRoomLock } from '../infrastructure/room-lock.js';

export type CommandResult = {
  result: GameResult;
  events: DomainEvent[];
};

export class GameCommandService {
  constructor(
    private readonly states: GameStateRepository = new InMemoryGameStateRepository(),
    private readonly records: GameRecordRepository = new InMemoryGameRecordRepository(),
    private readonly lock: RoomLock = new InMemoryRoomLock(),
    private readonly engine = new GameEngine(),
    private readonly ai = new AiPlayer()
  ) {}

  async startLocalGame(roomId: string, ruleConfig: RuleConfig, playerIds: PlayerId[]): Promise<GameState> {
    const state = this.engine.createGame(ruleConfig, { roomId, gameId: `g_${roomId}`, playerIds });
    await this.states.save(roomId, state);
    return state;
  }

  async playCard(roomId: string, playerId: PlayerId, cardIds: string[], chooseColor?: PlayableColor): Promise<CommandResult> {
    return this.run(roomId, playerId, 'play_card', { cardIds, chooseColor }, (state) =>
      this.engine.playCards(state, playerId, cardIds, chooseColor)
    );
  }

  async drawCard(roomId: string, playerId: PlayerId): Promise<CommandResult> {
    return this.run(roomId, playerId, 'draw_card', {}, (state) => this.engine.drawCard(state, playerId));
  }

  async passTurn(roomId: string, playerId: PlayerId): Promise<CommandResult> {
    return this.run(roomId, playerId, 'pass_turn', {}, (state) => this.engine.passTurn(state, playerId));
  }

  async callU(roomId: string, playerId: PlayerId): Promise<CommandResult> {
    return this.run(roomId, playerId, 'call_u', {}, (state) => this.engine.callU(state, playerId));
  }

  async catchMissedCall(roomId: string, catcherId: PlayerId, targetPlayerId: PlayerId): Promise<CommandResult> {
    return this.run(roomId, catcherId, 'catch_missed_call', { targetPlayerId }, (state) =>
      this.engine.catchMissedCall(state, catcherId, targetPlayerId)
    );
  }

  async respondPlusFour(
    roomId: string,
    playerId: PlayerId,
    action: 'draw' | 'challenge' | 'stack_plus_four',
    cardId?: string,
    chooseColor?: PlayableColor
  ): Promise<CommandResult> {
    return this.run(roomId, playerId, 'respond_plus_four', { action, cardId, chooseColor }, (state) =>
      this.engine.respondPlusFour(state, playerId, action, cardId, chooseColor)
    );
  }

  async runAutoPlay(roomId: string, playerId: PlayerId): Promise<CommandResult> {
    return this.run(roomId, playerId, 'auto_play', {}, (state) => {
      const action = this.ai.decideAction(state, playerId);
      return this.applyAiAction(state, playerId, action);
    });
  }

  async getState(roomId: string): Promise<GameState | null> {
    return this.states.get(roomId);
  }

  async markPlayerOffline(roomId: string, playerId: PlayerId, autoPlayAt: number): Promise<GameState | null> {
    const state = await this.states.get(roomId);
    if (!state) {
      return null;
    }
    const next: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId
          ? { ...player, online: false, disconnectAt: Date.now(), autoPlayAt }
          : player
      )
    };
    await this.states.save(roomId, next);
    return next;
  }

  async markPlayerReconnected(roomId: string, playerId: PlayerId): Promise<GameState | null> {
    const state = await this.states.get(roomId);
    if (!state) {
      return null;
    }
    const next: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId
          ? { ...player, online: true, isAutoPlaying: false, disconnectAt: null, autoPlayAt: null }
          : player
      )
    };
    await this.states.save(roomId, next);
    return next;
  }

  async markPlayerAutoPlaying(roomId: string, playerId: PlayerId): Promise<GameState | null> {
    const state = await this.states.get(roomId);
    if (!state) {
      return null;
    }
    const next: GameState = {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, isAutoPlaying: true } : player
      )
    };
    await this.states.save(roomId, next);
    return next;
  }

  private async run(
    roomId: string,
    playerId: PlayerId,
    actionType: string,
    actionPayload: unknown,
    command: (state: GameState) => GameResult
  ): Promise<CommandResult> {
    return this.lock.withLock(roomId, async () => {
      const state = await this.states.get(roomId);
      if (!state) {
        const result: GameResult = {
          ok: false,
          state: this.engine.createGame(),
          events: [],
          errorCode: 'GAME_NOT_STARTED'
        };
        return { result, events: [] };
      }

      const result = command(state);
      if (result.ok) {
        await this.states.save(roomId, result.state);
        await this.records.appendAction({
          gameId: result.state.gameId,
          roomId,
          playerId,
          actionType,
          actionPayload,
          stateVersion: result.state.actionSeq,
          events: result.events
        });
        if (result.state.status === 'finished') {
          await this.records.saveFinishedGame(result.state);
        }
      }
      return { result, events: result.events };
    });
  }

  private applyAiAction(state: GameState, playerId: PlayerId, action: AiAction): GameResult {
    switch (action.type) {
      case 'play_card':
        return this.engine.playCards(state, playerId, action.cardIds, action.chooseColor);
      case 'draw_card':
        return this.engine.drawCard(state, playerId);
      case 'pass_turn':
        return this.engine.passTurn(state, playerId);
      case 'call_u':
        return this.engine.callU(state, playerId);
      case 'catch_missed_call':
        return this.engine.catchMissedCall(state, playerId, action.targetPlayerId);
      case 'plus_four_response':
        return this.engine.respondPlusFour(state, playerId, action.action, action.cardId, action.chooseColor);
      default:
        return this.engine.drawCard(state, playerId);
    }
  }
}
