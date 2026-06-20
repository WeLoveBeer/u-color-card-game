import { Body, Controller, Post } from '@nestjs/common';
import type { ApiResponse, WechatLoginRequest, WechatLoginResponse } from '@shared/protocol/http.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('wechat-login')
  wechatLogin(@Body() body: WechatLoginRequest): ApiResponse<WechatLoginResponse> {
    if (!body.code) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '缺少微信登录 code' } };
    }
    return { success: true, data: this.auth.loginWithWechatCode(body.code) };
  }
}
