import { Body, Controller, Post } from '@nestjs/common';
import type { AdRewardRequest, AdRewardResponse, ApiResponse } from '@shared/protocol/http.js';

@Controller('rewards')
export class RewardController {
  @Post('ad')
  claimAdReward(@Body() body: AdRewardRequest): ApiResponse<AdRewardResponse> {
    return {
      success: true,
      data: {
        rewardType: body.rewardType,
        coinDelta: body.rewardType === 'daily_coin' ? 100 : 0,
        currentCoin: 1100,
        todayClaimed: 1,
        todayLimit: 5
      }
    };
  }
}
