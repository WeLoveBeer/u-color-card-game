import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsView } from './SettingsView.js';

describe('SettingsView', () => {
  it('会构建全局设置开关', () => {
    const model = new SettingsView().build();

    expect(model.title).toBe('设置');
    expect(model.scope).toBe('global');
    expect(model.toggles.map((toggle) => toggle.key)).toEqual([
      'music',
      'soundEffect',
      'vibration',
      'playHint',
      'autoSortHand',
      'lowPowerMode'
    ]);
    expect(model.actions).toEqual([]);
  });

  it('对局内设置会包含托管和退出确认', () => {
    const model = new SettingsView().build({ ...DEFAULT_SETTINGS, music: false }, 'in_game');

    expect(model.toggles.find((toggle) => toggle.key === 'music')?.enabled).toBe(false);
    expect(model.actions.map((action) => action.action)).toEqual(['back_game', 'rules', 'auto_play', 'leave_room']);
    expect(model.actions.find((action) => action.action === 'leave_room')).toMatchObject({
      danger: true,
      confirmText: '退出后本局将由 AI 托管，确定退出吗？'
    });
  });

  it('可以切换单个设置项且不影响其他项', () => {
    const next = new SettingsView().toggle(DEFAULT_SETTINGS, 'lowPowerMode');

    expect(next.lowPowerMode).toBe(true);
    expect(next.music).toBe(true);
  });
});
