import { Controller, Get, Headers, Inject } from '@nestjs/common';
import type { ApiResponse, UserProfileDto } from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('users')
export class UserController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('me')
  async me(@Headers('authorization') authorization?: string): Promise<ApiResponse<UserProfileDto>> {
    const userId = await this.auth.resolveToken(authorization?.replace('Bearer ', ''));
    const user = userId ? await this.auth.getUser(userId) : null;
    return user
      ? { success: true, data: user }
      : { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
  }
}
