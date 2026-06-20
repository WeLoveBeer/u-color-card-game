import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import type {
  ApiResponse,
  ClaimTaskRewardRequest,
  ClaimTaskRewardResponse,
  TaskListResponse
} from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';
import { TaskService } from './task.service.js';

@Controller('tasks')
export class TaskController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TaskService) private readonly tasks: TaskService
  ) {}

  @Get()
  async list(@Headers('authorization') authorization?: string): Promise<ApiResponse<TaskListResponse>> {
    const userId = await this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    return {
      success: true,
      data: {
        items: await this.tasks.listTasks(userId),
        updatedAt: new Date().toISOString()
      }
    };
  }

  @Post('claim')
  async claim(
    @Body() body: ClaimTaskRewardRequest,
    @Headers('authorization') authorization?: string
  ): Promise<ApiResponse<ClaimTaskRewardResponse>> {
    const userId = await this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const task = (await this.tasks.listTasks(userId)).find((item) => item.id === body.taskId);
    if (!task) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '任务不存在' } };
    }
    if (task.status !== 'claimable') {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '任务暂不可领取' } };
    }
    const user = await this.auth.addCoin(userId, task.coinReward);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    await this.tasks.markClaimed(userId, body.taskId);
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

  private resolveUserId(authorization?: string): Promise<string | null> {
    return this.auth.resolveToken(authorization?.replace('Bearer ', ''));
  }
}
