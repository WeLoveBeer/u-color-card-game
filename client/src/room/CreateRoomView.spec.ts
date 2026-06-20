import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '@shared/index.js';
import { CreateRoomView } from './CreateRoomView.js';

describe('CreateRoomView', () => {
  it('会构建创建房间的分段控件、开关和底部操作', () => {
    const view = new CreateRoomView();
    const model = view.build({ ...DEFAULT_RULE_CONFIG, playerCount: 3, initialCards: 9, ruleSet: 'party' });

    expect(model.title).toBe('创建房间');
    expect(model.summary).toBe('3人 · 9张起手 · 30秒 · 欢乐规则');
    expect(model.actions).toEqual([
      { action: 'rules', title: '规则说明', primary: false },
      { action: 'create_room', title: '创建房间', primary: true }
    ]);
    const playerCountSection = model.sections.find((section) => section.key === 'playerCount');
    expect(playerCountSection?.type).toBe('segments');
    if (playerCountSection?.type !== 'segments') {
      throw new Error('playerCount should be a segment section');
    }
    expect(playerCountSection.options).toContainEqual({
      key: '3',
      label: '3人',
      selected: true
    });
    expect(model.sections.find((section) => section.key === 'aiFill' && section.type === 'toggle')).toMatchObject({
      title: 'AI 补位',
      enabled: true
    });
  });
});
