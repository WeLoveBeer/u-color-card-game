import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RoomController } from './room.controller.js';
import { RoomService } from './room.service.js';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService]
})
export class RoomModule {}
