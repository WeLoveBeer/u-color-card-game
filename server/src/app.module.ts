import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConfigModule } from './modules/config/config.module.js';
import { CosmeticModule } from './modules/cosmetic/cosmetic.module.js';
import { GameServerModule } from './modules/game/game-server.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { RewardModule } from './modules/reward/reward.module.js';
import { RoomModule } from './modules/room/room.module.js';
import { TaskModule } from './modules/task/task.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    UserModule,
    ConfigModule,
    RoomModule,
    GameServerModule,
    RewardModule,
    LeaderboardModule,
    TaskModule,
    CosmeticModule
  ]
})
export class AppModule {}
