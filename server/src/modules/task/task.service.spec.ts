import { describe, expect, it } from 'vitest';
import { TaskService } from './task.service.js';

describe('TaskService', () => {
  it('会根据真实对局结果推进任务进度', () => {
    const service = new TaskService();

    expect(service.listTasks('u1').map((task) => ({ id: task.id, progress: task.progress, status: task.status }))).toEqual([
      { id: 'daily_ai_game', progress: 0, status: 'todo' },
      { id: 'win_once', progress: 0, status: 'todo' }
    ]);

    service.recordGameOver('u1', [
      { playerId: 'u1', rank: 1, remainCardCount: 0, score: 0 },
      { playerId: 'u2', rank: 2, remainCardCount: 2, score: 20 },
      { playerId: 'ai_1', rank: 3, remainCardCount: 3, score: 30 }
    ]);

    expect(service.listTasks('u1').map((task) => ({ id: task.id, progress: task.progress, status: task.status }))).toEqual([
      { id: 'daily_ai_game', progress: 1, status: 'claimable' },
      { id: 'win_once', progress: 1, status: 'claimable' }
    ]);
    expect(service.listTasks('u2').find((task) => task.id === 'daily_ai_game')).toMatchObject({
      progress: 1,
      status: 'claimable'
    });
    expect(service.listTasks('ai_1').find((task) => task.id === 'daily_ai_game')).toMatchObject({
      progress: 0,
      status: 'todo'
    });

    service.markClaimed('u1', 'win_once');
    expect(service.listTasks('u1').find((task) => task.id === 'win_once')?.status).toBe('claimed');
  });
});
