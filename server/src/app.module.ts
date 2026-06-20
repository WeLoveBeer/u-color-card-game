import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConfigModule } from './modules/config/config.module.js';
import { GameServerModule } from './modules/game/game-server.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { RewardModule } from './modules/reward/reward.module.js';
import { RoomModule } from './modules/room/room.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [AuthModule, UserModule, ConfigModule, RoomModule, GameServerModule, RewardModule, LeaderboardModule]
})
export class AppModule {}
