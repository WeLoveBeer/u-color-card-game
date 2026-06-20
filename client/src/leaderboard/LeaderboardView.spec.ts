import { describe, expect, it } from 'vitest';
import type { CoinLeaderboardResponse } from '@shared/index.js';
import { LeaderboardView } from './LeaderboardView.js';

const data = (overrides: Partial<CoinLeaderboardResponse> = {}): CoinLeaderboardResponse => ({
  updatedAt: '2026-06-20T12:00:00.000Z',
  items: [
    { rank: 1, userId: 'u1', nickname: '牌神小七', avatar: 'a1', coin: 12860 },
    { rank: 2, userId: 'u2', nickname: '幸运星', avatar: 'a2', coin: 9520 },
    { rank: 3, userId: 'u3', nickname: '摸牌高手', avatar: 'a3', coin: 7350 },
    { rank: 4, userId: 'u4', nickname: '清风徐来', avatar: 'a4', coin: 6240 },
    { rank: 128, userId: 'me', nickname: '我的昵称', avatar: 'me-avatar', coin: 860 }
  ],
  me: { rank: 128, userId: 'me', nickname: '我的昵称', avatar: 'me-avatar', coin: 860 },
  ...overrides
});

describe('LeaderboardView', () => {
  it('会构建排行榜领奖台、列表和我的排名摘要', () => {
    const model = new LeaderboardView().build(data());

    expect(model.title).toBe('金币排行榜');
    expect(model.topActions.map((action) => action.action)).toEqual(['back', 'rules']);
    expect(model.podium.map((item) => item.medal)).toEqual(['gold', 'silver', 'bronze']);
    expect(model.podium[0]?.coinText).toBe('12,860');
    expect(model.list.map((item) => item.rank)).toEqual([4, 128]);
    expect(model.list.find((item) => item.userId === 'me')?.highlighted).toBe(true);
    expect(model.mySummary).toEqual({
      title: '我的昵称',
      coinText: '860',
      rankText: '第 128 名',
      avatar: 'me-avatar'
    });
    expect(model.footerText).toBe('按金币数量排名');
  });

  it('没有排行数据时展示空状态', () => {
    const model = new LeaderboardView().build(data({ items: [], me: undefined }));

    expect(model.empty).toBe(true);
    expect(model.emptyText).toBe('还没有排行数据，先来一局赚金币吧');
    expect(model.podium).toEqual([]);
    expect(model.list).toEqual([]);
    expect(model.mySummary).toBeNull();
  });
});
