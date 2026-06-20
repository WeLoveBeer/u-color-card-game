import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { ApiResponse, CreateRoomRequest, CreateRoomResponse } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';
import { RoomService } from './room.service.js';
import type { RoomRuntimeState } from './room.types.js';

@Controller('rooms')
export class RoomController {
  constructor(
    private readonly auth: AuthService,
    private readonly rooms: RoomService
  ) {}

  @Post()
  create(@Headers('authorization') authorization: string | undefined, @Body() body: CreateRoomRequest): ApiResponse<CreateRoomResponse> {
    const userId = this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    return { success: true, data: this.rooms.createRoom(userId, body) };
  }

  @Get(':roomId')
  get(@Param('roomId') roomId: string): ApiResponse<RoomRuntimeState> {
    const room = this.rooms.getRoom(roomId);
    return room
      ? { success: true, data: room }
      : { success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在或已结束' } };
  }
}
