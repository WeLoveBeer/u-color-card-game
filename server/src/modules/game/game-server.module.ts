import { Module } from '@nestjs/common';
import { GameCommandService, GameEventMapper } from '../../game/application/index.js';
import { GameGateway } from './game.gateway.js';
import { RoomModule } from '../room/room.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, RoomModule],
  providers: [GameGateway, GameCommandService, GameEventMapper]
})
export class GameServerModule {}
