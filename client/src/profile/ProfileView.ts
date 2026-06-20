import type { UserProfileDto } from '@shared/index.js';

export type ProfileViewModel = {
  title: '我的';
  user: {
    id: string;
    nickname: string;
    avatar: string;
    coinText: string;
    selectedCardBackId: string;
  } | null;
  actions: Array<{ action: 'leaderboard' | 'card_back' | 'settings' | 'rules'; title: string; iconKey: string }>;
  loginHint: string | null;
};

export class ProfileView {
  build(user: UserProfileDto | null): ProfileViewModel {
    return {
      title: '我的',
      user: user
        ? {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar || 'avatar.player.default',
            coinText: new Intl.NumberFormat('zh-CN').format(user.coin),
            selectedCardBackId: user.selectedCardBackId ?? 'default'
          }
        : null,
      actions: [
        { action: 'leaderboard', title: '金币排行榜', iconKey: 'icon.rank' },
        { action: 'card_back', title: '牌背', iconKey: 'icon.card_back' },
        { action: 'settings', title: '设置', iconKey: 'icon.settings' },
        { action: 'rules', title: '规则说明', iconKey: 'icon.rules' }
      ],
      loginHint: user ? null : '登录后查看我的金币、排行和牌背'
    };
  }
}
