import { describe, expect, it } from 'vitest';
import type { SocketLike } from '../net/WsClient.js';
import { WsClient } from '../net/WsClient.js';
import type { VisibleGameState } from '@shared/index.js';
import { GameInteractionController } from './GameInteractionController.js';

const socketWithMessages = () => {
  const messages: string[] = [];
  const socket: SocketLike = {
    send: (data) => messages.push(data),
    close: () => undefined,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null
  };
  return { socket, messages };
};

const state = (overrides: Partial<VisibleGameState> = {}): VisibleGameState => ({
  roomId: 'r1',
  gameId: 'g1',
  status: 'playing',
  players: [{ id: 'me', seatIndex: 0, handCount: 3, online: true, isAi: false, isAutoPlaying: false }],
  currentPlayerId: 'me',
  direction: 1,
  currentColor: 'blue',
  discardTop: { id: 'top', color: 'blue', type: 'number', value: '2' },
  myHand: [
    { id: 'red-3', color: 'red', type: 'number', value: '3' },
    { id: 'blue-7', color: 'blue', type: 'number', value: '7' },
    { id: 'wild', color: 'wild', type: 'wild_color' }
  ],
  deckCount: 20,
  pendingDrawCount: 0,
  pendingChallenge: null,
  turnDeadline: 0,
  turnSeq: 1,
  stateVersion: 1,
  ...overrides
});

describe('GameInteractionController', () => {
  it('第一次点击可出牌只选中，第二次点击提交出牌', () => {
    const { socket, messages } = socketWithMessages();
    const ws = new WsClient('ws://local', () => socket);
    ws.connect('token');
    const controller = new GameInteractionController(ws);

    expect(controller.tapCard(state(), 'me', 'blue-7')).toEqual({ type: 'selected', cardId: 'blue-7' });
    expect(controller.tapCard(state(), 'me', 'blue-7', 'blue-7')).toEqual({ type: 'submitted', seq: 1, cardId: 'blue-7' });
    expect(JSON.parse(messages[0] ?? '')).toMatchObject({
      seq: 1,
      type: 'play_card',
      data: { roomId: 'r1', cardIds: ['blue-7'] }
    });
  });

  it('第二次点击变色牌会要求打开颜色选择器', () => {
    const { socket, messages } = socketWithMessages();
    const ws = new WsClient('ws://local', () => socket);
    ws.connect('token');

    const result = new GameInteractionController(ws).tapCard(state(), 'me', 'wild', 'wild');

    expect(result).toEqual({ type: 'choose_color', cardId: 'wild' });
    expect(messages).toHaveLength(0);
  });

  it('不可出牌和非本人回合会返回拒绝提示', () => {
    const { socket } = socketWithMessages();
    const ws = new WsClient('ws://local', () => socket);
    ws.connect('token');
    const controller = new GameInteractionController(ws);

    expect(controller.tapCard(state(), 'me', 'red-3')).toEqual({ type: 'rejected', message: '这张牌现在不能出' });
    expect(controller.tapCard(state({ currentPlayerId: 'p2' }), 'me', 'blue-7')).toEqual({ type: 'rejected', message: '还没轮到你' });
  });

  it('有可出牌时点击摸牌堆先要求确认，确认后发送摸牌', () => {
    const { socket, messages } = socketWithMessages();
    const ws = new WsClient('ws://local', () => socket);
    ws.connect('token');
    const controller = new GameInteractionController(ws);

    expect(controller.tapDeck(state(), 'me')).toEqual({ type: 'confirm_draw', message: '当前有可出牌，仍要摸牌吗？' });
    expect(controller.tapDeck(state(), 'me', true)).toEqual({ type: 'submitted', seq: 1 });
    expect(JSON.parse(messages[0] ?? '')).toMatchObject({ seq: 1, type: 'draw_card', data: { roomId: 'r1' } });
  });
});
