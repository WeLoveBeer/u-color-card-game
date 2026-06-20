import { describe, expect, it } from 'vitest';
import { JoinRoomView } from './JoinRoomView.js';

describe('JoinRoomView', () => {
  it('会规范化房号并启用加入按钮', () => {
    const model = new JoinRoomView().build(' ab12 ', [
      { roomId: 'ROOM1', playerCount: 2, maxPlayers: 4, status: 'playing', lastJoinedAt: '2026-06-20T12:00:00.000Z' }
    ]);

    expect(model.input).toMatchObject({
      value: 'AB12',
      valid: true,
      error: null
    });
    expect(model.primaryButton.disabled).toBe(false);
    expect(model.recentRooms[0]).toMatchObject({ statusText: '对局中', action: 'rejoin_room' });
    expect(model.emptyText).toBeNull();
  });

  it('房号无效时显示错误和最近房间空状态', () => {
    const model = new JoinRoomView().build('12');

    expect(model.input.valid).toBe(false);
    expect(model.input.error).toBe('房号格式不正确');
    expect(model.primaryButton.disabled).toBe(true);
    expect(model.emptyText).toBe('还没有最近房间，可以输入好友分享的房间号');
  });
});
