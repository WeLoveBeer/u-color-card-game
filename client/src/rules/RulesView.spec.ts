import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '@shared/index.js';
import { RulesView } from './RulesView.js';

describe('RulesView', () => {
  it('没有房间配置时展示通用规则说明', () => {
    const model = new RulesView().build();

    expect(model.title).toBe('规则说明');
    expect(model.roomSummary).toBeNull();
    expect(model.sections.map((section) => section.key)).toEqual([
      'basic',
      'action_cards',
      'draw_and_challenge',
      'call_u',
      'room_rules',
      'settlement',
      'fairness'
    ]);
    expect(model.sections.find((section) => section.key === 'room_rules')?.enabled).toBe(false);
  });

  it('有房间配置时展示当前规则摘要和开关状态', () => {
    const model = new RulesView().build({
      ...DEFAULT_RULE_CONFIG,
      playerCount: 3,
      initialCards: 9,
      turnSeconds: 60,
      ruleSet: 'party',
      plusTwoStack: true,
      sameColorDump: true,
      callUPenalty: false
    });

    expect(model.roomSummary).toBe('3人 · 9张起手 · 60秒 · 欢乐规则');
    expect(model.sections.find((section) => section.key === 'call_u')?.enabled).toBe(false);
    expect(model.sections.find((section) => section.key === 'room_rules')?.body).toContain('加二叠加：开');
    expect(model.sections.find((section) => section.key === 'room_rules')?.body).toContain('忘喊 U 罚牌：关');
  });
});
