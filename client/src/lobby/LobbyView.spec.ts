import { describe, expect, it } from 'vitest';
import type { UserProfileDto } from '@shared/index.js';
import { LobbyView } from './LobbyView.js';

describe('LobbyView', () => {
  it('会构建首页顶部、主入口、奖励和断线回归入口', () => {
    const user: UserProfileDto = {
      id: 'u1',
      nickname: '小牌手',
      avatar: 'avatar.url',
      coin: 12345
    };

    const view = new LobbyView();
    const model = view.build(user, {
      firstVisit: true,
      rankSummary: '当前第 128 名',
      resumeRoom: {
        roomId: 'room-1',
        title: '检测到未完成房间',
        subtitle: '点击返回对局'
      },
      dailyReward: {
        claimed: false,
        progress: 1,
        total: 1,
        coinReward: 100
      }
    });

    expect(model.topBar.nickname).toBe('小牌手');
    expect(model.topBar.coinText).toBe('12,345');
    expect(model.topBar.actions.map((action) => action.action)).toEqual(['rules', 'settings']);
    expect(model.logoAssetKey).toBe('logo.u_color_card');
    expect(model.resumeRoom).toMatchObject({ roomId: 'room-1', action: 'join_room' });
    expect(model.primaryActions.map((action) => action.action)).toEqual(['quick_ai', 'create_room', 'join_room']);
    expect(model.secondaryCards).toContainEqual({
      action: 'daily_reward',
      title: '每日奖励',
      subtitle: '登录领取 100 金币',
      iconKey: 'icon.coin_stack',
      badge: '可领取',
      progress: '1/1'
    });
    expect(model.noviceTip).toBe('先来一局人机练习，熟悉规则');
  });

  it('未登录时使用游客首页默认值', () => {
    const model = new LobbyView().build(null);

    expect(model.topBar.nickname).toBe('游客玩家');
    expect(model.topBar.avatar).toBe('avatar.default');
    expect(model.topBar.coinText).toBe('0');
    expect(model.resumeRoom).toBeNull();
    expect(model.bottomTabs.find((tab) => tab.tab === '首页')?.active).toBe(true);
    expect(model.noviceTip).toBeNull();
  });
});
