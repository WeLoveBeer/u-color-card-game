import { DEFAULT_RULE_CONFIG, type RuleConfig } from '@shared/index.js';

export type CreateRoomSegmentKey = 'playerCount' | 'initialCards' | 'turnSeconds' | 'ruleSet' | 'rounds';
export type CreateRoomToggleKey = 'plusTwoStack' | 'plusFourEnabled' | 'plusFourChallenge' | 'callUPenalty' | 'aiFill';

export type CreateRoomOption = {
  key: string;
  label: string;
  selected: boolean;
};

export type CreateRoomSection =
  | {
      type: 'segments';
      key: CreateRoomSegmentKey;
      title: string;
      options: CreateRoomOption[];
    }
  | {
      type: 'toggle';
      key: CreateRoomToggleKey;
      title: string;
      subtitle: string;
      enabled: boolean;
    };

export type CreateRoomViewModel = {
  title: '创建房间';
  summary: string;
  sections: CreateRoomSection[];
  actions: Array<{ action: 'rules' | 'create_room'; title: string; primary: boolean }>;
};

export class CreateRoomView {
  defaultConfig(): RuleConfig {
    return { ...DEFAULT_RULE_CONFIG };
  }

  build(config: RuleConfig = this.defaultConfig()): CreateRoomViewModel {
    return {
      title: '创建房间',
      summary: this.summarize(config),
      sections: [
        this.segment('playerCount', '人数', [
          ['2', '2人'],
          ['3', '3人'],
          ['4', '4人']
        ], String(config.playerCount)),
        this.segment('initialCards', '初始手牌', [
          ['5', '5张'],
          ['7', '7张'],
          ['9', '9张']
        ], String(config.initialCards)),
        this.segment('turnSeconds', '出牌倒计时', [
          ['15', '15秒'],
          ['30', '30秒'],
          ['60', '60秒']
        ], String(config.turnSeconds)),
        this.segment('ruleSet', '功能牌规则', [
          ['standard', '标准'],
          ['party', '欢乐']
        ], config.ruleSet),
        this.toggle('plusTwoStack', '加二叠加', '允许连续打出 +2 累计摸牌', config.plusTwoStack),
        this.toggle('plusFourEnabled', '强制摸四', '开启变色 +4 功能牌', config.plusFourEnabled),
        this.toggle('plusFourChallenge', '强制摸四质疑', '允许被影响玩家发起质疑', config.plusFourChallenge),
        this.toggle('callUPenalty', '忘喊 U 罚牌', '剩一张前未喊 U 可被抓罚牌', config.callUPenalty),
        this.toggle('aiFill', 'AI 补位', '好友不足时可补 AI 开始', config.aiFill),
        this.segment('rounds', '局数', [
          ['1', '1局'],
          ['3', '3局'],
          ['5', '5局']
        ], String(config.rounds))
      ],
      actions: [
        { action: 'rules', title: '规则说明', primary: false },
        { action: 'create_room', title: '创建房间', primary: true }
      ]
    };
  }

  summarize(config: RuleConfig): string {
    return `${config.playerCount}人 · ${config.initialCards}张起手 · ${config.turnSeconds}秒 · ${config.ruleSet === 'party' ? '欢乐规则' : '标准规则'}`;
  }

  private segment(
    key: CreateRoomSegmentKey,
    title: string,
    options: Array<[string, string]>,
    selectedKey: string
  ): CreateRoomSection {
    return {
      type: 'segments',
      key,
      title,
      options: options.map(([optionKey, label]) => ({ key: optionKey, label, selected: optionKey === selectedKey }))
    };
  }

  private toggle(key: CreateRoomToggleKey, title: string, subtitle: string, enabled: boolean): CreateRoomSection {
    return { type: 'toggle', key, title, subtitle, enabled };
  }
}
