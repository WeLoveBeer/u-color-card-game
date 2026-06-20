import { describe, expect, it } from 'vitest';
import type { RoomStateMessage } from '@shared/index.js';
import { DEFAULT_RULE_CONFIG } from '@shared/index.js';
import { RoomView } from './RoomView.js';

const room = (overrides: Partial<RoomStateMessage['data']> = {}): RoomStateMessage['data'] => ({
  roomId: 'r1',
  ownerId: 'p1',
  status: 'waiting',
  config: { ...DEFAULT_RULE_CONFIG, playerCount: 4, aiFill: false },
  players: [
    { id: 'p1', seatIndex: 0, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: true, nickname: '房主' },
    { id: 'p2', seatIndex: 1, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: false, nickname: '玩家2' }
  ],
  ...overrides
});

describe('RoomView', () => {
  it('房主在人数不足且未开启 AI 补位时不能开始', () => {
    const model = new RoomView().build(room(), 'p1');

    expect(model.viewerRole).toBe('owner');
    expect(model.seats).toHaveLength(4);
    expect(model.seats.filter((seat) => seat.empty)).toHaveLength(2);
    expect(model.primaryButton).toEqual({
      action: 'start_game',
      title: '等待玩家加入',
      disabled: true,
      reason: '人数不足'
    });
  });

  it('开启 AI 补位后房主可以开始并补 AI', () => {
    const model = new RoomView().build(room({ config: { ...DEFAULT_RULE_CONFIG, playerCount: 4, aiFill: true } }), 'p1');

    expect(model.primaryButton.title).toBe('开始并补 AI');
    expect(model.primaryButton.disabled).toBe(false);
  });

  it('满员但有玩家未准备时房主需要等待准备', () => {
    const model = new RoomView().build(
      room({
        players: [
          { id: 'p1', seatIndex: 0, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: true },
          { id: 'p2', seatIndex: 1, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: false },
          { id: 'p3', seatIndex: 2, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: true },
          { id: 'p4', seatIndex: 3, handCount: 0, online: true, isAi: true, isAutoPlaying: false, ready: true }
        ]
      }),
      'p1'
    );

    expect(model.primaryButton.title).toBe('等待准备');
    expect(model.primaryButton.reason).toBe('仍有玩家未准备');
  });

  it('非房主根据准备状态显示准备或取消准备', () => {
    const view = new RoomView();

    expect(view.build(room(), 'p2').primaryButton.title).toBe('准备');
    expect(
      view.build(
        room({
          players: [
            { id: 'p1', seatIndex: 0, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: true },
            { id: 'p2', seatIndex: 1, handCount: 0, online: true, isAi: false, isAutoPlaying: false, ready: true }
          ]
        }),
        'p2'
      ).primaryButton.title
    ).toBe('取消准备');
  });
});
