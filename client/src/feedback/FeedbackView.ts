import type { ApiError } from '@shared/index.js';

export type NetworkState = 'connected' | 'reconnecting' | 'reconnected' | 'failed';

export type FeedbackBannerViewModel = {
  tone: 'info' | 'success' | 'warning' | 'danger';
  message: string;
  action: { action: 'retry' | 'back_lobby' | 'reinput_room'; title: string } | null;
};

export class FeedbackView {
  network(state: NetworkState): FeedbackBannerViewModel | null {
    if (state === 'connected') {
      return null;
    }
    if (state === 'reconnecting') {
      return { tone: 'warning', message: '网络连接断开，正在重连...', action: null };
    }
    if (state === 'reconnected') {
      return { tone: 'success', message: '已恢复对局', action: null };
    }
    return { tone: 'danger', message: '重连失败，本局将由 AI 托管', action: { action: 'retry', title: '重试' } };
  }

  error(error: ApiError): FeedbackBannerViewModel {
    if (error.code === 'ROOM_NOT_FOUND') {
      return {
        tone: 'danger',
        message: '房间不存在或已结束',
        action: { action: 'reinput_room', title: '重新输入' }
      };
    }
    if (error.code === 'NOT_YOUR_TURN') {
      return { tone: 'warning', message: '还没轮到你', action: null };
    }
    if (error.code === 'ILLEGAL_CARD') {
      return { tone: 'warning', message: '这张牌现在不能出', action: null };
    }
    if (error.code === 'UNAUTHORIZED') {
      return { tone: 'danger', message: '登录已失效，请重新进入', action: { action: 'back_lobby', title: '返回大厅' } };
    }
    return { tone: 'danger', message: error.message || '操作失败，请稍后重试', action: null };
  }
}
