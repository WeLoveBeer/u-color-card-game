import { describe, expect, it } from 'vitest';
import { CardBackView } from './CardBackView.js';

describe('CardBackView', () => {
  it('会按拥有和来源构建牌背操作', () => {
    const model = new CardBackView().build([
      { id: 'default', title: '默认牌背', assetKey: 'card_back.default', owned: true, selected: true, source: 'default' },
      { id: 'trial', title: '限时牌背', assetKey: 'card_back.trial', owned: false, selected: false, source: 'ad_trial' },
      { id: 'locked', title: '活动牌背', assetKey: 'card_back.event', owned: false, selected: false, source: 'event' }
    ]);

    expect(model.items.map((item) => item.badge)).toEqual(['使用中', '广告体验', '未拥有']);
    expect(model.items.map((item) => item.action.title)).toEqual(['使用中', '看广告体验', '未解锁']);
    expect(model.emptyText).toBeNull();
  });
});
