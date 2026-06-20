import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import type {
  ApiResponse,
  ClaimTaskRewardRequest,
  ClaimTaskRewardResponse,
  TaskItemDto,
  TaskListResponse
} from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('tasks')
export class TaskController {
  private readonly claimedTasks = new Map<string, Set<string>>();

  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  list(@Headers('authorization') authorization?: string): ApiResponse<TaskListResponse> {
    const userId = this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    return {
      success: true,
      data: {
        items: this.tasksFor(userId),
        updatedAt: new Date().toISOString()
      }
    };
  }

  @Post('claim')
  claim(
    @Body() body: ClaimTaskRewardRequest,
    @Headers('authorization') authorization?: string
  ): ApiResponse<ClaimTaskRewardResponse> {
    const userId = this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const task = this.tasksFor(userId).find((item) => item.id === body.taskId);
    if (!task) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '任务不存在' } };
    }
    if (task.status !== 'claimable') {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '任务暂不可领取' } };
    }
    const user = this.auth.addCoin(userId, task.coinReward);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const claimed = this.claimedTasks.get(userId) ?? new Set<string>();
    claimed.add(body.taskId);
    this.claimedTasks.set(userId, claimed);
    return {
      success: true,
      data: {
        taskId: body.taskId,
        coinDelta: task.coinReward,
        currentCoin: user.coin,
        status: 'claimed'
      }
    };
  }

  private resolveUserId(authorization?: string): string | null {
    return this.auth.resolveToken(authorization?.replace('Bearer ', ''));
  }

  private tasksFor(userId: string): TaskItemDto[] {
    const claimed = this.claimedTasks.get(userId) ?? new Set<string>();
    return [
      {
        id: 'daily_ai_game',
        title: '完成一局人机',
        description: '任意胜负都算完成',
        progress: 1,
        target: 1,
        coinReward: 50,
        status: claimed.has('daily_ai_game') ? 'claimed' : 'claimable'
      },
      {
        id: 'win_once',
        title: '赢一局',
        description: '取得任意模式胜利',
        progress: 0,
        target: 1,
        coinReward: 100,
        status: 'todo'
      }
    ];
  }
}
