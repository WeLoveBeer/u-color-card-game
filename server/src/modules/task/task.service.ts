import { Inject, Injectable, Optional } from '@nestjs/common';
import type { PlayerId, Ranking } from '@shared/domain/game-state.js';
import type { TaskItemDto } from '@shared/protocol/http.js';
import { PrismaService } from '../../common/prisma.service.js';

type TaskStats = {
  gamesPlayed: number;
  gamesWon: number;
  claimed: Set<string>;
};

@Injectable()
export class TaskService {
  private readonly stats = new Map<PlayerId, TaskStats>();

  constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}

  async listTasks(userId: PlayerId): Promise<TaskItemDto[]> {
    if (this.prisma?.enabled) {
      const today = this.today();
      const [dailyStat, claims] = await Promise.all([
        (this.prisma as any).userDailyStat.findUnique({ where: { userId_statDate: { userId, statDate: today } } }),
        (this.prisma as any).userTaskClaim.findMany({ where: { userId, claimDate: today } })
      ]);
      const stats: TaskStats = {
        gamesPlayed: dailyStat?.gamesPlayed ?? 0,
        gamesWon: dailyStat?.gamesWon ?? 0,
        claimed: new Set<string>(claims.map((claim: { taskId: string }) => claim.taskId))
      };
      return this.items(stats);
    }
    const stats = this.getStats(userId);
    return this.items(stats);
  }

  async markClaimed(userId: PlayerId, taskId: string): Promise<void> {
    if (this.prisma?.enabled) {
      await (this.prisma as any).userTaskClaim.upsert({
        where: { userId_taskId_claimDate: { userId, taskId, claimDate: this.today() } },
        update: {},
        create: { userId, taskId, claimDate: this.today() }
      });
      return;
    }
    this.getStats(userId).claimed.add(taskId);
  }

  async recordGameOver(winnerId: PlayerId, rankings: Ranking[]): Promise<void> {
    for (const ranking of rankings) {
      if (ranking.playerId.startsWith('ai_')) {
        continue;
      }
      if (this.prisma?.enabled) {
        await (this.prisma as any).userDailyStat.upsert({
          where: { userId_statDate: { userId: ranking.playerId, statDate: this.today() } },
          update: {
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: ranking.playerId === winnerId ? 1 : 0 }
          },
          create: {
            userId: ranking.playerId,
            statDate: this.today(),
            gamesPlayed: 1,
            gamesWon: ranking.playerId === winnerId ? 1 : 0
          }
        });
        continue;
      }
      const stats = this.getStats(ranking.playerId);
      stats.gamesPlayed += 1;
      if (ranking.playerId === winnerId) {
        stats.gamesWon += 1;
      }
    }
  }

  private items(stats: TaskStats): TaskItemDto[] {
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

  private today(): Date {
    const today = new Date().toISOString().slice(0, 10);
    return new Date(`${today}T00:00:00.000Z`);
  }
}
