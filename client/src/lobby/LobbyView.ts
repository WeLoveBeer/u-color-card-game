import type { UserProfileDto } from '@shared/index.js';

export type LobbyAction = 'quick_ai' | 'create_room' | 'join_room' | 'leaderboard' | 'rules' | 'settings';
export type BottomTab = '首页' | '任务' | '牌背' | '我的';

export type ResumeRoomHint = {
  roomId: string;
  title: string;
  subtitle: string;
};

export type DailyRewardStatus = {
  claimed: boolean;
  progress: number;
  total: number;
  coinReward: number;
};

export type LobbyBuildOptions = {
  resumeRoom?: ResumeRoomHint | null;
  dailyReward?: DailyRewardStatus | null;
  rankSummary?: string | null;
  firstVisit?: boolean;
};

export type LobbyViewModel = {
  title: 'U彩牌';
  user: UserProfileDto | null;
  topBar: {
    nickname: string;
    avatar: string;
    coinText: string;
    actions: Array<{ action: Extract<LobbyAction, 'rules' | 'settings'>; title: string; iconKey: string }>;
  };
  logoAssetKey: 'logo.u_color_card';
  resumeRoom: (ResumeRoomHint & { action: 'join_room' }) | null;
  primaryActions: Array<{ action: LobbyAction; title: string; subtitle: string; iconKey: string; tone: 'green' | 'blue' | 'teal' }>;
  secondaryCards: Array<{ action: LobbyAction | 'daily_reward'; title: string; subtitle: string; iconKey: string; badge?: string; progress?: string }>;
  bottomTabs: Array<{ tab: BottomTab; active: boolean; iconKey: string }>;
  noviceTip: string | null;
};

export class LobbyView {
  build(user: UserProfileDto | null, options: LobbyBuildOptions = {}): LobbyViewModel {
    const dailyReward = options.dailyReward ?? null;
    return {
      title: 'U彩牌',
      user,
      topBar: {
        nickname: user?.nickname ?? '游客玩家',
        avatar: user?.avatar ?? 'avatar.default',
        coinText: this.formatCoin(user?.coin ?? 0),
        actions: [
          { action: 'rules', title: '规则', iconKey: 'icon.book' },
          { action: 'settings', title: '设置', iconKey: 'icon.settings' }
        ]
      },
      logoAssetKey: 'logo.u_color_card',
      resumeRoom: options.resumeRoom ? { ...options.resumeRoom, action: 'join_room' } : null,
      primaryActions: [
        { action: 'quick_ai', title: '快速人机', subtitle: '随时开局，轻松对战', iconKey: 'icon.bot', tone: 'green' },
        { action: 'create_room', title: '创建房间', subtitle: '邀请好友，欢乐开局', iconKey: 'icon.room', tone: 'blue' },
        { action: 'join_room', title: '加入房间', subtitle: '输入房号，加入对局', iconKey: 'icon.room', tone: 'teal' }
      ],
      secondaryCards: this.secondaryCards(options.rankSummary ?? null, dailyReward),
      bottomTabs: [
        { tab: '首页', active: true, iconKey: 'icon.home' },
        { tab: '任务', active: false, iconKey: 'icon.task' },
        { tab: '牌背', active: false, iconKey: 'icon.card_back' },
        { tab: '我的', active: false, iconKey: 'icon.profile' }
      ],
      noviceTip: options.firstVisit ? '先来一局人机练习，熟悉规则' : null
    };
  }

  private secondaryCards(rankSummary: string | null, dailyReward: DailyRewardStatus | null): LobbyViewModel['secondaryCards'] {
    const cards: LobbyViewModel['secondaryCards'] = [
      {
        action: 'leaderboard',
        title: '金币排行榜',
        subtitle: rankSummary ?? '高手云集，等你上榜',
        iconKey: 'icon.rank'
      }
    ];
    if (dailyReward) {
      cards.push({
        action: 'daily_reward',
        title: '每日奖励',
        subtitle: dailyReward.claimed ? '今日金币已领取' : `登录领取 ${dailyReward.coinReward} 金币`,
        iconKey: 'icon.coin_stack',
        badge: dailyReward.claimed ? '已领取' : '可领取',
        progress: `${Math.min(dailyReward.progress, dailyReward.total)}/${dailyReward.total}`
      });
    }
    return cards;
  }

  private formatCoin(coin: number): string {
    return new Intl.NumberFormat('zh-CN').format(coin);
  }
}
