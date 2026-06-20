import { Controller, Get } from '@nestjs/common';
import type { ApiResponse, CoinLeaderboardResponse } from '@shared/protocol/http.js';

@Controller('leaderboards')
export class LeaderboardController {
  @Get('coins')
  coins(): ApiResponse<CoinLeaderboardResponse> {
    return {
      success: true,
      data: {
        items: [],
        updatedAt: new Date().toISOString()
      }
    };
  }
}
