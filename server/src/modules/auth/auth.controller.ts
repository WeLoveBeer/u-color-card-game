import { Body, Controller, Inject, Post } from '@nestjs/common';
import type { ApiResponse, WechatLoginRequest, WechatLoginResponse } from '@shared/protocol/http.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('wechat-login')
  async wechatLogin(@Body() body: WechatLoginRequest): Promise<ApiResponse<WechatLoginResponse>> {
    if (!body.code) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '缺少微信登录 code' } };
    }
    return { success: true, data: await this.auth.loginWithWechatCode(body.code) };
  }
}
