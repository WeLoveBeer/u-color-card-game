import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller.js';

@Module({
  controllers: [LeaderboardController]
})
export class LeaderboardModule {}
