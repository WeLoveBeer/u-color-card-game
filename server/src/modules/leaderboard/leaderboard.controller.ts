import { Controller, Get, Headers, Inject, Query } from '@nestjs/common';
import type { ApiResponse, CoinLeaderboardResponse } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('leaderboards')
export class LeaderboardController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('coins')
  coins(@Query('limit') limitValue?: string, @Headers('authorization') authorization?: string): ApiResponse<CoinLeaderboardResponse> {
    const limit = this.limit(limitValue);
    const ranked = this.auth
      .listUsers()
      .sort((a, b) => b.coin - a.coin || a.id.localeCompare(b.id))
      .map((user, index) => ({
        rank: index + 1,
        userId: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        coin: user.coin
      }));
    const userId = this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    return {
      success: true,
      data: {
        items: ranked.slice(0, limit),
        me: userId ? ranked.find((item) => item.userId === userId) : undefined,
        updatedAt: new Date().toISOString()
      }
    };
  }

  private limit(value?: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 100;
    }
    return Math.min(100, Math.max(1, Math.floor(parsed)));
  }
}
