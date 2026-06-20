export type TaskStatus = 'todo' | 'claimable' | 'claimed';

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  coinReward: number;
  status: TaskStatus;
};

export type TaskViewModel = {
  title: '任务';
  items: Array<
    TaskItem & {
      progressText: string;
      action: { action: 'claim_task_reward'; title: '领取' | '已领取' | '去完成'; disabled: boolean };
    }
  >;
  emptyText: string | null;
};

export class TaskView {
  build(items: TaskItem[] = []): TaskViewModel {
    return {
      title: '任务',
      items: items.map((item) => ({
        ...item,
        progressText: `${Math.min(item.progress, item.target)}/${item.target}`,
        action: this.action(item.status)
      })),
      emptyText: items.length === 0 ? '暂无任务，先来一局赚金币吧' : null
    };
  }

  private action(status: TaskStatus): TaskViewModel['items'][number]['action'] {
    if (status === 'claimable') {
      return { action: 'claim_task_reward', title: '领取', disabled: false };
    }
    if (status === 'claimed') {
      return { action: 'claim_task_reward', title: '已领取', disabled: true };
    }
    return { action: 'claim_task_reward', title: '去完成', disabled: true };
  }
}
