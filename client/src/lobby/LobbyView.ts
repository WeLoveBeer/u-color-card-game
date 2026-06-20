import type { UserProfileDto } from '@shared/index.js';

export type LobbyAction = 'quick_ai' | 'create_room' | 'join_room' | 'leaderboard' | 'rules' | 'settings';

export type LobbyViewModel = {
  title: 'U彩牌';
  user: UserProfileDto | null;
  primaryActions: Array<{ action: LobbyAction; title: string; subtitle: string; iconKey: string; tone: 'green' | 'blue' | 'teal' }>;
  secondaryCards: Array<{ action: LobbyAction; title: string; subtitle: string; iconKey: string }>;
  bottomTabs: Array<'首页' | '任务' | '牌背' | '我的'>;
};

export class LobbyView {
  build(user: UserProfileDto | null): LobbyViewModel {
    return {
      title: 'U彩牌',
      user,
      primaryActions: [
        { action: 'quick_ai', title: '快速人机', subtitle: '随时开局，轻松对战', iconKey: 'icon.bot', tone: 'green' },
        { action: 'create_room', title: '创建房间', subtitle: '邀请好友，欢乐开局', iconKey: 'icon.room', tone: 'blue' },
        { action: 'join_room', title: '加入房间', subtitle: '输入房号，加入对局', iconKey: 'icon.room', tone: 'teal' }
      ],
      secondaryCards: [
        { action: 'leaderboard', title: '金币排行榜', subtitle: '高手云集，等你上榜', iconKey: 'icon.rank' }
      ],
      bottomTabs: ['首页', '任务', '牌背', '我的']
    };
  }
}
