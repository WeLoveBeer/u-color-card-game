import { Controller, Get, Headers } from '@nestjs/common';
import type { ApiResponse, UserProfileDto } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('users')
export class UserController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Headers('authorization') authorization?: string): ApiResponse<UserProfileDto> {
    const userId = this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    const user = userId ? this.auth.getUser(userId) : null;
    return user
      ? { success: true, data: user }
      : { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
  }
}
