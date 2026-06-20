import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import type { WsServerMessage } from '@shared/protocol/ws-server-events.js';
import { AppModule } from '../../app.module.js';

type MessageOf<T extends WsServerMessage['type']> = Extract<WsServerMessage, { type: T }>;

function waitForMessage<T extends WsServerMessage['type']>(socket: Socket, type: T, timeoutMs = 3000): Promise<MessageOf<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error(`timeout waiting for ${type}`));
    }, timeoutMs);

    const onMessage = (message: WsServerMessage) => {
      if (message.type === type) {
        clearTimeout(timer);
        socket.off('message', onMessage);
        resolve(message as MessageOf<T>);
      }
    };

    socket.on('message', onMessage);
  });
}

function emitClientMessage(socket: Socket, type: string, data: unknown, seq: number): void {
  socket.emit('message', { seq, type, data });
}

describe('服务端接口与 WebSocket 主流程', () => {
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      socket.close();
    }
    await app.close();
  });

  it('可以登录、创建房间、加入并开始一局，然后执行一次对局操作', async () => {
    const ownerLogin = await request(baseUrl)
      .post('/api/auth/wechat-login')
      .send({ code: 'owner-code' })
      .expect(201);
    const guestLogin = await request(baseUrl)
      .post('/api/auth/wechat-login')
      .send({ code: 'guest-code' })
      .expect(201);

    const ownerToken = ownerLogin.body.data.token as string;
    const guestToken = guestLogin.body.data.token as string;
    const ownerId = ownerLogin.body.data.user.id as string;
    const guestId = guestLogin.body.data.user.id as string;

    const config = { ...DEFAULT_RULE_CONFIG, playerCount: 2 as const, aiFill: false };
    const roomResponse = await request(baseUrl)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(config)
      .expect(201);

    const roomId = roomResponse.body.data.roomId as string;
    await request(baseUrl).get(`/api/rooms/${roomId}`).expect(200).expect((response) => {
      expect(response.body.success).toBe(true);
      expect(response.body.data.ownerId).toBe(ownerId);
    });

    const ownerSocket = io(baseUrl, { path: '/ws', query: { token: ownerToken }, transports: ['websocket'] });
    const guestSocket = io(baseUrl, { path: '/ws', query: { token: guestToken }, transports: ['websocket'] });
    sockets.push(ownerSocket, guestSocket);

    await Promise.all([
      new Promise<void>((resolve) => ownerSocket.on('connect', () => resolve())),
      new Promise<void>((resolve) => guestSocket.on('connect', () => resolve()))
    ]);

    const ownerJoined = waitForMessage(ownerSocket, 'room_state');
    emitClientMessage(ownerSocket, 'join_room', { roomId }, 1);
    expect((await ownerJoined).type).toBe('room_state');

    const guestJoined = waitForMessage(guestSocket, 'room_state');
    emitClientMessage(guestSocket, 'join_room', { roomId }, 2);
    const joinedState = await guestJoined;
    expect(joinedState.type).toBe('room_state');
    expect(joinedState.data.players.map((player: { id: string }) => player.id)).toContain(guestId);

    const readyMessage = waitForMessage(ownerSocket, 'room_state');
    emitClientMessage(guestSocket, 'ready', { roomId, ready: true }, 3);
    expect((await readyMessage).type).toBe('room_state');

    const gameStart = waitForMessage(ownerSocket, 'game_start');
    emitClientMessage(ownerSocket, 'start_game', { roomId }, 4);
    const started = await gameStart;
    expect(started.type).toBe('game_start');
    expect(started.data.roomId).toBe(roomId);

    const currentPlayerId = started.data.state.currentPlayerId;
    const currentSocket = currentPlayerId === ownerId ? ownerSocket : guestSocket;
    const drawEvent = waitForMessage(currentSocket, 'card_drawn');
    emitClientMessage(currentSocket, 'draw_card', { roomId }, 5);
    const drawn = await drawEvent;
    expect(drawn.type).toBe('card_drawn');
    expect(drawn.data.playerId).toBe(currentPlayerId);
  });
});
