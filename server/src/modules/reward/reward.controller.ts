import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import type { AdRewardRequest, AdRewardResponse, ApiResponse } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('rewards')
export class RewardController {
  private readonly dailyClaims = new Map<string, Map<string, number>>();

  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('ad')
  claimAdReward(@Body() body: AdRewardRequest, @Headers('authorization') authorization?: string): ApiResponse<AdRewardResponse> {
    const userId = this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const today = new Date().toISOString().slice(0, 10);
    const userClaims = this.dailyClaims.get(userId) ?? new Map<string, number>();
    const claimed = userClaims.get(today) ?? 0;
    const todayLimit = this.todayLimit(body.rewardType);
    if (claimed >= todayLimit) {
      const user = this.auth.getUser(userId);
      return {
        success: true,
        data: {
          rewardType: body.rewardType,
          coinDelta: 0,
          currentCoin: user?.coin ?? 0,
          todayClaimed: claimed,
          todayLimit
        }
      };
    }
    const coinDelta = this.coinDelta(body.rewardType);
    const user = this.auth.addCoin(userId, coinDelta);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    userClaims.set(today, claimed + 1);
    this.dailyClaims.set(userId, userClaims);
    return {
      success: true,
      data: {
        rewardType: body.rewardType,
        coinDelta,
        currentCoin: user.coin,
        todayClaimed: claimed + 1,
        todayLimit
      }
    };
  }

  private coinDelta(rewardType: AdRewardRequest['rewardType']): number {
    if (rewardType === 'daily_coin') {
      return 100;
    }
    if (rewardType === 'settlement_double') {
      return 50;
    }
    return 0;
  }

  private todayLimit(rewardType: AdRewardRequest['rewardType']): number {
    return rewardType === 'daily_coin' ? 1 : 5;
  }
}
