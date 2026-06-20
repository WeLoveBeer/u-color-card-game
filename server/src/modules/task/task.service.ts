import { Injectable } from '@nestjs/common';
import type { PlayerId, Ranking } from '@shared/domain/game-state.js';
import type { TaskItemDto } from '@shared/protocol/http.js';

type TaskStats = {
  gamesPlayed: number;
  gamesWon: number;
  claimed: Set<string>;
};

@Injectable()
export class TaskService {
  private readonly stats = new Map<PlayerId, TaskStats>();

  listTasks(userId: PlayerId): TaskItemDto[] {
    const stats = this.getStats(userId);
    return [
      {
        id: 'daily_ai_game',
        title: '完成一局人机',
        description: '任意胜负都算完成',
        progress: Math.min(stats.gamesPlayed, 1),
        target: 1,
        coinReward: 50,
        status: this.status(stats, 'daily_ai_game', stats.gamesPlayed >= 1)
      },
      {
        id: 'win_once',
        title: '赢一局',
        description: '取得任意模式胜利',
        progress: Math.min(stats.gamesWon, 1),
        target: 1,
        coinReward: 100,
        status: this.status(stats, 'win_once', stats.gamesWon >= 1)
      }
    ];
  }

  markClaimed(userId: PlayerId, taskId: string): void {
    this.getStats(userId).claimed.add(taskId);
  }

  recordGameOver(winnerId: PlayerId, rankings: Ranking[]): void {
    for (const ranking of rankings) {
      if (ranking.playerId.startsWith('ai_')) {
        continue;
      }
      const stats = this.getStats(ranking.playerId);
      stats.gamesPlayed += 1;
      if (ranking.playerId === winnerId) {
        stats.gamesWon += 1;
      }
    }
  }

  private status(stats: TaskStats, taskId: string, complete: boolean): TaskItemDto['status'] {
    if (stats.claimed.has(taskId)) {
      return 'claimed';
    }
    return complete ? 'claimable' : 'todo';
  }

  private getStats(userId: PlayerId): TaskStats {
    const stats = this.stats.get(userId) ?? { gamesPlayed: 0, gamesWon: 0, claimed: new Set<string>() };
    this.stats.set(userId, stats);
    return stats;
  }
}
