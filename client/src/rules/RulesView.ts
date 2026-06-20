import type { RuleConfig } from '@shared/index.js';

export type RuleGroupKey = 'basic' | 'action_cards' | 'draw_and_challenge' | 'call_u' | 'room_rules' | 'settlement' | 'fairness';

export type RuleSectionViewModel = {
  key: RuleGroupKey;
  title: string;
  body: string;
  enabled: boolean;
};

export type RulesViewModel = {
  title: '规则说明';
  roomSummary: string | null;
  sections: RuleSectionViewModel[];
};

export class RulesView {
  build(config?: RuleConfig | null): RulesViewModel {
    return {
      title: '规则说明',
      roomSummary: config ? this.summary(config) : null,
      sections: [
        {
          key: 'basic',
          title: '基础出牌',
          body: '打出与顶部牌颜色相同、数字相同或功能相同的牌。没有可出牌时，需要摸一张。',
          enabled: true
        },
        {
          key: 'action_cards',
          title: '功能牌',
          body: '禁行会跳过下一位玩家；转向会改变出牌方向；加二会让下一位玩家摸 2 张并跳过；变色会选择下一轮颜色。',
          enabled: true
        },
        {
          key: 'draw_and_challenge',
          title: '加牌与质疑',
          body: '强制摸四可以选择颜色。若开启质疑，被影响玩家可以质疑；质疑成功则出牌者摸 4 张，失败则自己摸 6 张并跳过。',
          enabled: config?.plusFourEnabled ?? true
        },
        {
          key: 'call_u',
          title: '忘喊 U',
          body: '当你手里还剩 2 张牌，打出其中 1 张之前需要先喊 U。没有先喊 U 被抓成功后，需要摸 2 张牌。',
          enabled: config?.callUPenalty ?? true
        },
        {
          key: 'room_rules',
          title: '房间规则',
          body: config ? this.roomRuleText(config) : '当前房间开启的自定义规则会在这里展示。',
          enabled: Boolean(config)
        },
        {
          key: 'settlement',
          title: '胜负结算',
          body: '先出完手牌的玩家获胜，结算页会展示排名、剩余手牌数、金币变化和本局奖励。',
          enabled: true
        },
        {
          key: 'fairness',
          title: '公平随机',
          body: '每局由服务端随机洗牌，客户端不能修改牌序。',
          enabled: true
        }
      ]
    };
  }

  private summary(config: RuleConfig): string {
    return `${config.playerCount}人 · ${config.initialCards}张起手 · ${config.turnSeconds}秒 · ${config.ruleSet === 'party' ? '欢乐规则' : '标准规则'}`;
  }

  private roomRuleText(config: RuleConfig): string {
    const flags = [
      `强制摸四：${config.plusFourEnabled ? '开' : '关'}`,
      `强制摸四质疑：${config.plusFourChallenge ? '开' : '关'}`,
      `加二叠加：${config.plusTwoStack ? '开' : '关'}`,
      `同色全出：${config.sameColorDump ? '开' : '关'}`,
      `忘喊 U 罚牌：${config.callUPenalty ? '开' : '关'}`
    ];
    return flags.join('；');
  }
}
