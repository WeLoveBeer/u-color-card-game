import { describe, expect, it } from 'vitest';
import { FeedbackView } from './FeedbackView.js';

describe('FeedbackView', () => {
  it('会构建网络重连状态提示', () => {
    const view = new FeedbackView();

    expect(view.network('connected')).toBeNull();
    expect(view.network('reconnecting')).toEqual({
      tone: 'warning',
      message: '网络连接断开，正在重连...',
      action: null
    });
    expect(view.network('reconnected')).toMatchObject({ tone: 'success', message: '已恢复对局' });
    expect(view.network('failed')).toMatchObject({
      tone: 'danger',
      message: '重连失败，本局将由 AI 托管',
      action: { action: 'retry', title: '重试' }
    });
  });

  it('会把常见错误码映射成用户可读提示', () => {
    const view = new FeedbackView();

    expect(view.error({ code: 'ROOM_NOT_FOUND', message: 'not found' })).toEqual({
      tone: 'danger',
      message: '房间不存在或已结束',
      action: { action: 'reinput_room', title: '重新输入' }
    });
    expect(view.error({ code: 'NOT_YOUR_TURN', message: 'not turn' }).message).toBe('还没轮到你');
    expect(view.error({ code: 'ILLEGAL_CARD', message: 'illegal' }).message).toBe('这张牌现在不能出');
    expect(view.error({ code: 'SERVER_ERROR', message: '服务器错误' })).toMatchObject({
      tone: 'danger',
      message: '服务器错误'
    });
  });
});
