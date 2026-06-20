import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { CoinDelta, DomainEvent, Ranking } from '@shared/domain/game-state.js';
import type { WsClientMessage } from '@shared/protocol/ws-client-events.js';
import type { WsServerMessage } from '@shared/protocol/ws-server-events.js';
import { GameCommandService, GameEventMapper, toVisibleGameState } from '../../game/application/index.js';
import { AuthService } from '../auth/auth.service.js';
import { RoomService } from '../room/room.service.js';
import { TaskService } from '../task/task.service.js';

@WebSocketGateway({ path: '/ws', cors: true })
export class GameGateway {
  @WebSocketServer()
  private server!: Server;
  private readonly socketRooms = new Map<string, string>();
  private readonly autoPlayTimers = new Map<string, NodeJS.Timeout>();
  private readonly aiTurnTimers = new Map<string, NodeJS.Timeout>();
  private readonly autoPlayDelayMs = 15000;
  private readonly aiThinkMinMs = 900;
  private readonly aiThinkMaxMs = 1800;

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(GameCommandService) private readonly commands: GameCommandService,
    @Inject(GameEventMapper) private readonly mapper: GameEventMapper,
    @Inject(TaskService) private readonly tasks: TaskService
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = String(socket.handshake.query.token ?? '');
    const userId = await this.auth.resolveToken(token);
    if (!userId) {
      socket.emit('message', this.error(undefined, 'UNAUTHORIZED', '未登录或 token 失效'));
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = socket.data.userId as string | undefined;
    const roomId = socket.data.roomId as string | undefined;
    if (!userId || !roomId) {
      return;
    }

    const autoPlayAt = Date.now() + this.autoPlayDelayMs;
    const room = await this.rooms.markOffline(roomId, userId, autoPlayAt);
    await this.commands.markPlayerOffline(roomId, userId, autoPlayAt);
    this.socketRooms.delete(socket.id);
    if (!room) {
      return;
    }
    this.server.to(roomId).emit('message', {
      type: 'player_offline',
      serverTime: Date.now(),
      data: { roomId, playerId: userId, autoPlayAt }
    });
    this.scheduleAutoPlay(roomId, userId);
  }

  @SubscribeMessage('message')
  async onMessage(@ConnectedSocket() socket: Socket, @MessageBody() message: WsClientMessage): Promise<void> {
    const userId = socket.data.userId as string | undefined;
    const seq = message.seq;
    if (!userId) {
      socket.emit('message', this.error(seq, 'UNAUTHORIZED', '未登录或 token 失效'));
      return;
    }

    switch (message.type) {
      case 'join_room':
        await this.joinRoom(socket, userId, message);
        return;
      case 'leave_room':
        await this.leaveRoom(socket, userId, message);
        return;
      case 'ready':
        await this.ready(socket, userId, message);
        return;
      case 'start_game':
        await this.startGame(socket, userId, message);
        return;
      case 'play_card':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.playCard(message.data.roomId, userId, message.data.cardIds, message.data.chooseColor)
        );
        return;
      case 'draw_card':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.drawCard(message.data.roomId, userId)
        );
        return;
      case 'pass_turn':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.passTurn(message.data.roomId, userId)
        );
        return;
      case 'call_u':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.callU(message.data.roomId, userId)
        );
        return;
      case 'catch_missed_call':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.catchMissedCall(message.data.roomId, userId, message.data.targetPlayerId)
        );
        return;
      case 'respond_plus_four':
        await this.broadcastCommand(socket, message.data.roomId, userId, message.seq, () =>
          this.commands.respondPlusFour(
            message.data.roomId,
            userId,
            message.data.action,
            message.data.cardId,
            message.data.chooseColor
          )
        );
        return;
      case 'reconnect':
        await this.reconnect(socket, userId, message);
        return;
      default:
        socket.emit('message', this.error(seq, 'INVALID_PARAMS', '未知消息类型'));
    }
  }

  private async joinRoom(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'join_room' }>): Promise<void> {
    const room = await this.rooms.joinRoom(message.data.roomId, userId);
    if (!room) {
      socket.emit('message', this.error(message.seq, 'ROOM_NOT_FOUND', '房间不存在或已开始'));
      return;
    }
    await socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    this.socketRooms.set(socket.id, room.roomId);
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'room_state',
      serverTime: Date.now(),
      data: room
    });
  }

  private async leaveRoom(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'leave_room' }>): Promise<void> {
    const room = await this.rooms.leaveRoom(message.data.roomId, userId);
    await socket.leave(message.data.roomId);
    socket.data.roomId = undefined;
    this.socketRooms.delete(socket.id);
    if (!room) {
      socket.emit('message', {
        seq: message.seq,
        type: 'room_state',
        serverTime: Date.now(),
        data: {
          roomId: message.data.roomId,
          ownerId: userId,
          status: 'finished',
          config: {},
          players: []
        }
      });
      return;
    }
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'room_state',
      serverTime: Date.now(),
      data: room
    });
  }

  private async ready(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'ready' }>): Promise<void> {
    const room = await this.rooms.setReady(message.data.roomId, userId, message.data.ready);
    if (!room) {
      socket.emit('message', this.error(message.seq, 'NOT_IN_ROOM', '玩家不在房间中'));
      return;
    }
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'room_state',
      serverTime: Date.now(),
      data: room
    });
  }

  private async startGame(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'start_game' }>): Promise<void> {
    const room = await this.rooms.getRoom(message.data.roomId);
    if (!room) {
      socket.emit('message', this.error(message.seq, 'ROOM_NOT_FOUND', '房间不存在或已结束'));
      return;
    }
    if (room.ownerId !== userId) {
      socket.emit('message', this.error(message.seq, 'NOT_ROOM_OWNER', '不是房主'));
      return;
    }

    while (room.players.length < room.config.playerCount && room.config.aiFill) {
      room.players.push({
        id: `ai_${room.players.length + 1}`,
        ready: true,
        seatIndex: room.players.length,
        online: true,
        isAi: true
      });
    }

    if (room.players.length < room.config.playerCount || room.players.some((player) => !player.ready)) {
      socket.emit('message', this.error(message.seq, 'INVALID_PARAMS', '人数不足或仍有玩家未准备'));
      return;
    }

    await this.rooms.markPlaying(room.roomId);
    const state = await this.commands.startLocalGame(
      room.roomId,
      room.config,
      room.players.map((player) => player.id)
    );
    await this.emitGameStart(room.roomId, message.seq, state);
    this.scheduleAiTurnIfNeeded(state);
  }

  private async broadcastCommand(
    socket: Socket,
    roomId: string,
    viewerId: string,
    seq: number,
    command: () => ReturnType<GameCommandService['playCard']>
  ): Promise<void> {
    const { result, events } = await command();
    if (!result.ok) {
      socket.emit('message', this.error(seq, result.errorCode ?? 'SERVER_ERROR', '操作失败'));
      return;
    }
    const settledEvents = await this.settleGameOverEvents(events);
    await this.broadcastEvents(roomId, result.state, settledEvents, seq);
    this.scheduleAiTurnIfNeeded(result.state);
  }

  private async reconnect(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'reconnect' }>): Promise<void> {
    const room = message.data.roomId ? await this.rooms.getRoom(message.data.roomId) : await this.rooms.findRoomByPlayer(userId);
    if (!room || !room.players.some((player) => player.id === userId)) {
      socket.emit('message', this.error(message.seq, 'ROOM_NOT_FOUND', '房间不存在或已结束'));
      return;
    }

    await this.rooms.markReconnected(room.roomId, userId);
    const state = await this.commands.markPlayerReconnected(room.roomId, userId);
    await socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    this.socketRooms.set(socket.id, room.roomId);
    this.clearAutoPlay(room.roomId, userId);

    socket.emit('message', {
      seq: message.seq,
      type: 'room_state',
      serverTime: Date.now(),
      data: await this.rooms.getRoom(room.roomId)
    });
    if (state) {
      socket.emit('message', {
        seq: message.seq,
        type: 'game_state',
        serverTime: Date.now(),
        data: toVisibleGameState(state, userId)
      });
      this.scheduleAiTurnIfNeeded(state);
    }
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'player_reconnected',
      serverTime: Date.now(),
      data: { roomId: room.roomId, playerId: userId }
    });
  }

  private async emitGameStart(roomId: string, seq: number, state: Awaited<ReturnType<GameCommandService['startLocalGame']>>): Promise<void> {
    for (const socket of await this.server.in(roomId).fetchSockets()) {
      const socketUserId = socket.data.userId as string | undefined;
      if (!socketUserId) {
        continue;
      }
      socket.emit('message', {
        seq,
        type: 'game_start',
        serverTime: Date.now(),
        data: { roomId, gameId: state.gameId, state: toVisibleGameState(state, socketUserId) }
      });
    }
  }

  private scheduleAutoPlay(roomId: string, playerId: string): void {
    const key = `${roomId}:${playerId}`;
    this.clearAutoPlay(roomId, playerId);
    this.autoPlayTimers.set(
      key,
      setTimeout(() => {
        void this.startAutoPlay(roomId, playerId);
      }, this.autoPlayDelayMs)
    );
  }

  private scheduleAiTurnIfNeeded(state: Awaited<ReturnType<GameCommandService['getState']>>): void {
    if (!state || state.status !== 'playing') {
      return;
    }
    const current = state.players.find((player) => player.id === state.currentPlayerId);
    if (!current?.isAi) {
      this.clearAiTurn(state.roomId);
      return;
    }
    const key = state.roomId;
    this.clearAiTurn(state.roomId);
    const delay = this.aiThinkDelayMs();
    const expectedTurnSeq = state.turnSeq;
    const playerId = current.id;
    this.aiTurnTimers.set(
      key,
      setTimeout(() => {
        void this.runScheduledAiTurn(state.roomId, playerId, expectedTurnSeq);
      }, delay)
    );
  }

  private clearAiTurn(roomId: string): void {
    const timer = this.aiTurnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.aiTurnTimers.delete(roomId);
    }
  }

  private aiThinkDelayMs(): number {
    return Math.floor(this.aiThinkMinMs + Math.random() * (this.aiThinkMaxMs - this.aiThinkMinMs + 1));
  }

  private clearAutoPlay(roomId: string, playerId: string): void {
    const key = `${roomId}:${playerId}`;
    const timer = this.autoPlayTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.autoPlayTimers.delete(key);
    }
  }

  private async startAutoPlay(roomId: string, playerId: string): Promise<void> {
    const room = await this.rooms.markAutoPlaying(roomId, playerId);
    if (!room) {
      return;
    }
    await this.commands.markPlayerAutoPlaying(roomId, playerId);
    this.server.to(roomId).emit('message', {
      type: 'player_auto_play_started',
      serverTime: Date.now(),
      data: { roomId, playerId }
    });
    const state = await this.commands.getState(roomId);
    if (state?.currentPlayerId === playerId) {
      const { result, events } = await this.commands.runAutoPlay(roomId, playerId);
      if (result.ok) {
        const settledEvents = await this.settleGameOverEvents(events);
        await this.broadcastEvents(roomId, result.state, settledEvents);
        this.scheduleAiTurnIfNeeded(result.state);
      }
    }
  }

  private async runScheduledAiTurn(roomId: string, playerId: string, expectedTurnSeq: number): Promise<void> {
    this.aiTurnTimers.delete(roomId);
    const state = await this.commands.getState(roomId);
    const current = state?.players.find((player) => player.id === playerId);
    if (!state || state.status !== 'playing' || state.currentPlayerId !== playerId || state.turnSeq !== expectedTurnSeq || !current?.isAi) {
      return;
    }
    const { result, events } = await this.commands.runAutoPlay(roomId, playerId);
    if (!result.ok) {
      return;
    }
    const settledEvents = await this.settleGameOverEvents(events);
    await this.broadcastEvents(roomId, result.state, settledEvents);
    this.scheduleAiTurnIfNeeded(result.state);
  }

  private async broadcastEvents(roomId: string, state: Parameters<GameEventMapper['toMessages']>[0], events: DomainEvent[], seq?: number): Promise<void> {
    for (const socket of await this.server.in(roomId).fetchSockets()) {
      const socketUserId = socket.data.userId as string | undefined;
      if (!socketUserId) {
        continue;
      }
      const messages = this.mapper.toMessages(state, socketUserId, events) as WsServerMessage[];
      for (const item of messages) {
        socket.emit('message', seq === undefined ? item : { ...item, seq });
      }
    }
  }

  private async settleGameOverEvents(events: DomainEvent[]): Promise<DomainEvent[]> {
    const settled: DomainEvent[] = [];
    for (const event of events) {
      if (event.type !== 'game_over') {
        settled.push(event);
        continue;
      }
      await this.tasks.recordGameOver(event.winnerId, event.rankings);
      settled.push({ ...event, coinDeltas: await this.settleCoinDeltas(event.winnerId, event.rankings) });
    }
    return settled;
  }

  private async settleCoinDeltas(winnerId: string, rankings: Ranking[]): Promise<CoinDelta[]> {
    const winner = await this.auth.getUser(winnerId);
    let winnerGain = 0;
    const loserDeltas: CoinDelta[] = [];

    for (const ranking of rankings) {
      if (ranking.playerId === winnerId) {
        continue;
      }
      const user = await this.auth.getUser(ranking.playerId);
      const loss = Math.min(ranking.score, user?.coin ?? ranking.score);
      winnerGain += loss;
      const updated = user ? await this.auth.addCoin(ranking.playerId, -loss) : null;
      loserDeltas.push({
        playerId: ranking.playerId,
        coinDelta: -loss,
        coinAfter: updated?.coin ?? Math.max(0, (user?.coin ?? loss) - loss)
      });
    }

    const updatedWinner = winner ? await this.auth.addCoin(winnerId, winnerGain) : null;
    return [
      {
        playerId: winnerId,
        coinDelta: winnerGain,
        coinAfter: updatedWinner?.coin ?? ((winner?.coin ?? 0) + winnerGain)
      },
      ...loserDeltas
    ];
  }

  private error(seq: number | undefined, code: WsServerMessage extends never ? never : string, message: string) {
    return { seq, type: 'error', serverTime: Date.now(), error: { code, message } };
  }
}
