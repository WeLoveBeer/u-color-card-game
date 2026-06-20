import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RewardController } from './reward.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [RewardController]
})
export class RewardModule {}
