import { describe, expect, it } from 'vitest';
import type { UserProfileDto } from '@shared/index.js';
import { LobbyView } from '../lobby/LobbyView.js';
import { LobbyRenderer } from './LobbyRenderer.js';

describe('LobbyRenderer', () => {
  it('把大厅 ViewModel 渲染为入口按钮、顶部栏和底部 tab', () => {
    const user: UserProfileDto = {
      id: 'u1',
      nickname: '小牌手',
      avatar: 'avatar.url',
      coin: 12345
    };
    const model = new LobbyView().build(user, {
      firstVisit: true,
      rankSummary: '当前第 128 名',
      resumeRoom: { roomId: 'room-1', title: '检测到未完成房间', subtitle: '点击返回对局' },
      dailyReward: { claimed: false, progress: 1, total: 1, coinReward: 100 }
    });

    const tree = new LobbyRenderer().render(model, { width: 1080, height: 1920, safeTop: 44, safeBottom: 24 });

    expect(tree.commands.find((command) => command.id === 'lobby-title')).toMatchObject({ type: 'text', text: 'U彩牌' });
    expect(tree.commands.find((command) => command.id === 'primary-quick_ai-title')).toMatchObject({ type: 'text', text: '快速人机' });
    expect(tree.commands.find((command) => command.id === 'novice-tip')).toMatchObject({ type: 'text', text: '先来一局人机练习，熟悉规则' });
    expect(tree.hitAreas.map((area) => area.action)).toEqual(expect.arrayContaining(['quick_ai', 'create_room', 'join_room', 'leaderboard', 'daily_reward', 'rules', 'settings']));
    expect(tree.hitAreas.find((area) => area.id === 'hit-resume-room')).toMatchObject({ action: 'join_room', payload: { roomId: 'room-1' } });
  });
});

