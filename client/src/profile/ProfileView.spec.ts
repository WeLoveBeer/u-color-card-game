import { describe, expect, it } from 'vitest';
import type { UserProfileDto } from '@shared/index.js';
import { ProfileView } from './ProfileView.js';

describe('ProfileView', () => {
  it('会构建用户资料和常用入口', () => {
    const user: UserProfileDto = {
      id: 'u1',
      nickname: '小牌手',
      avatar: '',
      coin: 12345,
      selectedCardBackId: 'default'
    };

    const model = new ProfileView().build(user);

    expect(model.user).toEqual({
      id: 'u1',
      nickname: '小牌手',
      avatar: 'avatar.player.default',
      coinText: '12,345',
      selectedCardBackId: 'default'
    });
    expect(model.actions.map((action) => action.action)).toEqual(['leaderboard', 'card_back', 'settings', 'rules']);
    expect(model.loginHint).toBeNull();
  });

  it('未登录时展示登录提示', () => {
    const model = new ProfileView().build(null);

    expect(model.user).toBeNull();
    expect(model.loginHint).toBe('登录后查看我的金币、排行和牌背');
  });
});
