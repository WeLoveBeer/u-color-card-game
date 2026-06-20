export type SettingsScope = 'global' | 'in_game';

export type SettingsState = {
  music: boolean;
  soundEffect: boolean;
  vibration: boolean;
  playHint: boolean;
  autoSortHand: boolean;
  lowPowerMode: boolean;
};

export type SettingsToggleKey = keyof SettingsState;

export type SettingsToggleViewModel = {
  key: SettingsToggleKey;
  title: string;
  enabled: boolean;
};

export type SettingsActionViewModel = {
  action: 'back_game' | 'rules' | 'auto_play' | 'leave_room';
  title: string;
  danger: boolean;
  confirmText: string | null;
};

export type SettingsViewModel = {
  title: '设置';
  scope: SettingsScope;
  toggles: SettingsToggleViewModel[];
  actions: SettingsActionViewModel[];
};

export const DEFAULT_SETTINGS: SettingsState = {
  music: true,
  soundEffect: true,
  vibration: true,
  playHint: true,
  autoSortHand: true,
  lowPowerMode: false
};

export class SettingsView {
  build(state: SettingsState = DEFAULT_SETTINGS, scope: SettingsScope = 'global'): SettingsViewModel {
    return {
      title: '设置',
      scope,
      toggles: [
        { key: 'music', title: '音乐', enabled: state.music },
        { key: 'soundEffect', title: '音效', enabled: state.soundEffect },
        { key: 'vibration', title: '震动', enabled: state.vibration },
        { key: 'playHint', title: '出牌提示', enabled: state.playHint },
        { key: 'autoSortHand', title: '自动整理手牌', enabled: state.autoSortHand },
        { key: 'lowPowerMode', title: '低电量模式', enabled: state.lowPowerMode }
      ],
      actions: scope === 'in_game' ? this.inGameActions() : []
    };
  }

  toggle(state: SettingsState, key: SettingsToggleKey): SettingsState {
    return { ...state, [key]: !state[key] };
  }

  private inGameActions(): SettingsActionViewModel[] {
    return [
      { action: 'back_game', title: '返回对局', danger: false, confirmText: null },
      { action: 'rules', title: '规则说明', danger: false, confirmText: null },
      { action: 'auto_play', title: '托管', danger: false, confirmText: null },
      { action: 'leave_room', title: '退出房间', danger: true, confirmText: '退出后本局将由 AI 托管，确定退出吗？' }
    ];
  }
}
