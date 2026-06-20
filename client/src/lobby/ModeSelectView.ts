export type AiModeOption = {
  playerCount: 2 | 3 | 4;
  title: string;
  subtitle: string;
  recommended: boolean;
};

export class ModeSelectView {
  options(): AiModeOption[] {
    return [
      { playerCount: 2, title: '2 人快局', subtitle: '短局练手', recommended: false },
      { playerCount: 3, title: '3 人经典', subtitle: '推荐配置，强 AI 对手', recommended: true },
      { playerCount: 4, title: '4 人欢乐', subtitle: '节奏更热闹', recommended: false }
    ];
  }
}
