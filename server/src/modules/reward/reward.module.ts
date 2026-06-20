import { Module } from '@nestjs/common';
import { RewardController } from './reward.controller.js';

@Module({
  controllers: [RewardController]
})
export class RewardModule {}
