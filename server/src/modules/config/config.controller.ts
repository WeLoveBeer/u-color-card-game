import { Controller, Get } from '@nestjs/common';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import type { ApiResponse, AppConfigResponse } from '@shared/protocol/http.js';

@Controller('config')
export class ConfigController {
  @Get()
  getConfig(): ApiResponse<AppConfigResponse> {
    return {
      success: true,
      data: {
        minClientVersion: '1.0.0',
        adEnabled: true,
        defaultRoomConfig: DEFAULT_RULE_CONFIG
      }
    };
  }
}
