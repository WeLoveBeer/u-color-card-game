import { describe, expect, it } from 'vitest';
import { TaskView } from './TaskView.js';

describe('TaskView', () => {
  it('会构建任务进度和领取状态', () => {
    const model = new TaskView().build([
      { id: 'daily_ai', title: '完成一局人机', description: '任意胜负都算完成', progress: 1, target: 1, coinReward: 50, status: 'claimable' },
      { id: 'win_once', title: '赢一局', description: '取得任意模式胜利', progress: 0, target: 1, coinReward: 100, status: 'todo' }
    ]);

    expect(model.items[0]).toMatchObject({ progressText: '1/1', action: { title: '领取', disabled: false } });
    expect(model.items[1]).toMatchObject({ progressText: '0/1', action: { title: '去完成', disabled: true } });
    expect(model.emptyText).toBeNull();
  });

  it('没有任务时展示空状态', () => {
    expect(new TaskView().build().emptyText).toBe('暂无任务，先来一局赚金币吧');
  });
});
