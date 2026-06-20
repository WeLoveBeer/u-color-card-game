import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { WsClientMessage } from '@shared/protocol/ws-client-events.js';
import type { WsServerMessage } from '@shared/protocol/ws-server-events.js';
import { GameCommandService, GameEventMapper } from '../../game/application/index.js';
import { AuthService } from '../auth/auth.service.js';
import { RoomService } from '../room/room.service.js';

@WebSocketGateway({ path: '/ws', cors: true })
export class GameGateway {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly rooms: RoomService,
    private readonly commands: GameCommandService,
    private readonly mapper: GameEventMapper
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = String(socket.handshake.query.token ?? '');
    const userId = this.auth.resolveToken(token);
    if (!userId) {
      socket.emit('message', this.error(undefined, 'UNAUTHORIZED', '未登录或 token 失效'));
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
  }

  @SubscribeMessage('message')
  async onMessage(@ConnectedSocket() socket: Socket, @MessageBody() message: WsClientMessage): Promise<void> {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      socket.emit('message', this.error(message.seq, 'UNAUTHORIZED', '未登录或 token 失效'));
      return;
    }

    switch (message.type) {
      case 'join_room':
        await this.joinRoom(socket, userId, message);
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
        socket.emit('message', this.error(message.seq, 'ROOM_NOT_FOUND', '重连恢复将在 Redis 房间映射接入后启用'));
        return;
      default:
        socket.emit('message', this.error(message.seq, 'INVALID_PARAMS', '未知消息类型'));
    }
  }

  private async joinRoom(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'join_room' }>): Promise<void> {
    const room = this.rooms.joinRoom(message.data.roomId, userId);
    if (!room) {
      socket.emit('message', this.error(message.seq, 'ROOM_NOT_FOUND', '房间不存在或已开始'));
      return;
    }
    await socket.join(room.roomId);
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'room_state',
      serverTime: Date.now(),
      data: room
    });
  }

  private async ready(socket: Socket, userId: string, message: Extract<WsClientMessage, { type: 'ready' }>): Promise<void> {
    const room = this.rooms.setReady(message.data.roomId, userId, message.data.ready);
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
    const room = this.rooms.getRoom(message.data.roomId);
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

    this.rooms.markPlaying(room.roomId);
    const state = await this.commands.startLocalGame(
      room.roomId,
      room.config,
      room.players.map((player) => player.id)
    );
    this.server.to(room.roomId).emit('message', {
      seq: message.seq,
      type: 'game_start',
      serverTime: Date.now(),
      data: { roomId: room.roomId, gameId: state.gameId, state }
    });
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
    const messages = this.mapper.toMessages(result.state, viewerId, events) as WsServerMessage[];
    for (const item of messages) {
      this.server.to(roomId).emit('message', { ...item, seq });
    }
  }

  private error(seq: number | undefined, code: WsServerMessage extends never ? never : string, message: string) {
    return { seq, type: 'error', serverTime: Date.now(), error: { code, message } };
  }
}
