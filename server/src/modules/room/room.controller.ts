import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import type { ApiResponse, CreateRoomRequest, CreateRoomResponse } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';
import { RoomService } from './room.service.js';
import type { RoomRuntimeState } from './room.types.js';

@Controller('rooms')
export class RoomController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RoomService) private readonly rooms: RoomService
  ) {}

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateRoomRequest
  ): Promise<ApiResponse<CreateRoomResponse>> {
    const userId = await this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    return { success: true, data: await this.rooms.createRoom(userId, body) };
  }

  @Get(':roomId')
  async get(@Param('roomId') roomId: string): Promise<ApiResponse<RoomRuntimeState>> {
    const room = await this.rooms.getRoom(roomId);
    return room
      ? { success: true, data: room }
      : { success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在或已结束' } };
  }
}
