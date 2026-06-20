import { DEFAULT_RULE_CONFIG, type RuleConfig } from '@shared/index.js';

export class CreateRoomView {
  defaultConfig(): RuleConfig {
    return { ...DEFAULT_RULE_CONFIG };
  }

  summarize(config: RuleConfig): string {
    return `${config.playerCount}人 · ${config.initialCards}张起手 · ${config.turnSeconds}秒 · ${config.ruleSet === 'party' ? '欢乐规则' : '标准规则'}`;
  }
}
