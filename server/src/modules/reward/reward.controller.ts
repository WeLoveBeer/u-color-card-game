import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import type { AdRewardRequest, AdRewardResponse, ApiResponse } from '@shared/protocol/http.js';
import { PrismaService } from '../../common/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('rewards')
export class RewardController {
  private readonly dailyClaims = new Map<string, Map<string, number>>();

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Post('ad')
  async claimAdReward(
    @Body() body: AdRewardRequest,
    @Headers('authorization') authorization?: string
  ): Promise<ApiResponse<AdRewardResponse>> {
    const userId = await this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const today = this.today();
    const todayKey = today.toISOString().slice(0, 10);
    const claimed = await this.claimedCount(userId, body.rewardType, today, todayKey);
    const todayLimit = this.todayLimit(body.rewardType);
    if (claimed >= todayLimit) {
      const user = await this.auth.getUser(userId);
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
    const user = await this.auth.addCoin(userId, coinDelta);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    if (this.prisma.enabled) {
      await Promise.all([
        (this.prisma as any).adReward.create({
          data: {
            userId,
            rewardType: body.rewardType,
            amount: coinDelta,
            adUnitId: body.adUnitId,
            claimedDate: today
          }
        }),
        (this.prisma as any).userDailyStat.upsert({
          where: { userId_statDate: { userId, statDate: today } },
          update: {
            adRewardsClaimed: { increment: 1 },
            coinEarned: { increment: coinDelta }
          },
          create: {
            userId,
            statDate: today,
            adRewardsClaimed: 1,
            coinEarned: coinDelta
          }
        })
      ]);
    } else {
      const userClaims = this.dailyClaims.get(userId) ?? new Map<string, number>();
      userClaims.set(todayKey, claimed + 1);
      this.dailyClaims.set(userId, userClaims);
    }
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

  private async claimedCount(
    userId: string,
    rewardType: AdRewardRequest['rewardType'],
    today: Date,
    todayKey: string
  ): Promise<number> {
    if (this.prisma.enabled) {
      return (this.prisma as any).adReward.count({ where: { userId, rewardType, claimedDate: today } });
    }
    return this.dailyClaims.get(userId)?.get(todayKey) ?? 0;
  }

  private today(): Date {
    const today = new Date().toISOString().slice(0, 10);
    return new Date(`${today}T00:00:00.000Z`);
  }
}
