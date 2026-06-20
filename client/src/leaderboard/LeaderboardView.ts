import type { CoinLeaderboardResponse, LeaderboardItemDto } from '@shared/index.js';

export type LeaderboardItemViewModel = LeaderboardItemDto & {
  coinText: string;
  highlighted: boolean;
  medal: 'gold' | 'silver' | 'bronze' | null;
};

export type LeaderboardViewModel = {
  title: '金币排行榜';
  topActions: Array<{ action: 'back' | 'rules'; title: string; iconKey: string }>;
  podium: LeaderboardItemViewModel[];
  list: LeaderboardItemViewModel[];
  me: LeaderboardItemViewModel | null;
  mySummary: {
    title: string;
    coinText: string;
    rankText: string;
    avatar: string;
  } | null;
  empty: boolean;
  emptyText: string | null;
  footerText: '按金币数量排名';
  updatedAt: string;
};

export class LeaderboardView {
  build(data: CoinLeaderboardResponse): LeaderboardViewModel {
    const meId = data.me?.userId ?? null;
    const items = data.items.map((item) => this.item(item, meId));
    const me = data.me ? this.item(data.me, meId) : null;
    return {
      title: '金币排行榜',
      topActions: [
        { action: 'back', title: '返回', iconKey: 'icon.back' },
        { action: 'rules', title: '规则', iconKey: 'icon.help' }
      ],
      podium: items.slice(0, 3),
      list: items.slice(3),
      me,
      mySummary: me
        ? {
            title: me.nickname,
            coinText: me.coinText,
            rankText: `第 ${me.rank} 名`,
            avatar: me.avatar
          }
        : null,
      empty: items.length === 0,
      emptyText: items.length === 0 ? '还没有排行数据，先来一局赚金币吧' : null,
      footerText: '按金币数量排名',
      updatedAt: data.updatedAt
    };
  }

  private item(item: LeaderboardItemDto, meId: string | null): LeaderboardItemViewModel {
    return {
      ...item,
      coinText: new Intl.NumberFormat('zh-CN').format(item.coin),
      highlighted: item.userId === meId,
      medal: this.medal(item.rank)
    };
  }

  private medal(rank: number): LeaderboardItemViewModel['medal'] {
    if (rank === 1) {
      return 'gold';
    }
    if (rank === 2) {
      return 'silver';
    }
    if (rank === 3) {
      return 'bronze';
    }
    return null;
  }
}
