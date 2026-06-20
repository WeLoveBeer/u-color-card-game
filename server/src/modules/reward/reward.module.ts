import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RewardController } from './reward.controller.js';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [RewardController]
})
export class RewardModule {}
