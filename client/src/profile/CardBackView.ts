export type CardBackItem = {
  id: string;
  title: string;
  assetKey: string;
  owned: boolean;
  selected: boolean;
  source: 'default' | 'reward' | 'ad_trial' | 'shop' | 'event';
  expiresAt?: string | null;
};

export type CardBackViewModel = {
  title: '牌背';
  items: Array<
    CardBackItem & {
      badge: string;
      action: { action: 'select_card_back' | 'watch_ad_trial' | 'locked'; title: string; disabled: boolean };
    }
  >;
  emptyText: string | null;
};

export class CardBackView {
  build(items: CardBackItem[]): CardBackViewModel {
    return {
      title: '牌背',
      items: items.map((item) => ({
        ...item,
        badge: this.badge(item),
        action: this.action(item)
      })),
      emptyText: items.length === 0 ? '暂无可用牌背' : null
    };
  }

  private badge(item: CardBackItem): string {
    if (item.selected) {
      return '使用中';
    }
    if (item.owned) {
      return '已拥有';
    }
    if (item.source === 'ad_trial') {
      return '广告体验';
    }
    return '未拥有';
  }

  private action(item: CardBackItem): CardBackViewModel['items'][number]['action'] {
    if (item.selected) {
      return { action: 'select_card_back', title: '使用中', disabled: true };
    }
    if (item.owned) {
      return { action: 'select_card_back', title: '使用', disabled: false };
    }
    if (item.source === 'ad_trial') {
      return { action: 'watch_ad_trial', title: '看广告体验', disabled: false };
    }
    return { action: 'locked', title: '未解锁', disabled: true };
  }
}
