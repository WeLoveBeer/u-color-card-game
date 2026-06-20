import { Module } from '@nestjs/common';
import { GameCommandService, GameEventMapper } from '../../game/application/index.js';
import { InMemoryGameRecordRepository, InMemoryGameStateRepository, InMemoryRoomLock, PrismaGameRecordRepository, RedisGameStateRepository, RedisRoomLock } from '../../game/infrastructure/index.js';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { CommonModule } from '../../common/common.module.js';
import { GameGateway } from './game.gateway.js';
import { RoomModule } from '../room/room.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TaskModule } from '../task/task.module.js';

@Module({
  imports: [CommonModule, AuthModule, RoomModule, TaskModule],
  providers: [
    GameGateway,
    GameEventMapper,
    {
      provide: GameCommandService,
      inject: [RedisService, PrismaService],
      useFactory: (redis: RedisService, prisma: PrismaService) =>
        new GameCommandService(
          redis.enabled ? new RedisGameStateRepository(redis) : new InMemoryGameStateRepository(),
          prisma.enabled ? new PrismaGameRecordRepository(prisma) : new InMemoryGameRecordRepository(),
          redis.enabled ? new RedisRoomLock(redis) : new InMemoryRoomLock()
        )
    }
  ]
})
export class GameServerModule {}
