import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import type {
  ApiResponse,
  CardBackItemDto,
  CardBackListResponse,
  SelectCardBackRequest,
  SelectCardBackResponse
} from '@shared/protocol/http.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('cosmetics')
export class CosmeticController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('card-backs')
  cardBacks(@Headers('authorization') authorization?: string): ApiResponse<CardBackListResponse> {
    const userId = this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const user = this.auth.getUser(userId);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const selectedCardBackId = user.selectedCardBackId ?? 'default';
    return {
      success: true,
      data: {
        selectedCardBackId,
        items: this.cardBackItems(selectedCardBackId)
      }
    };
  }

  @Post('card-backs/select')
  selectCardBack(
    @Body() body: SelectCardBackRequest,
    @Headers('authorization') authorization?: string
  ): ApiResponse<SelectCardBackResponse> {
    const userId = this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const user = this.auth.getUser(userId);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const candidate = this.cardBackItems(user.selectedCardBackId ?? 'default').find((item) => item.id === body.cardBackId);
    if (!candidate || !candidate.owned) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '牌背未拥有或不存在' } };
    }
    const updated = this.auth.selectCardBack(userId, body.cardBackId);
    const selectedCardBackId = updated?.selectedCardBackId ?? body.cardBackId;
    return {
      success: true,
      data: {
        selectedCardBackId,
        items: this.cardBackItems(selectedCardBackId)
      }
    };
  }

  private resolveUserId(authorization?: string): string | null {
    return this.auth.resolveToken(authorization?.replace('Bearer ', ''));
  }

  private cardBackItems(selectedCardBackId: string): CardBackItemDto[] {
    return [
      {
        id: 'default',
        title: '默认牌背',
        assetKey: 'card_back.default',
        owned: true,
        selected: selectedCardBackId === 'default',
        source: 'default'
      },
      {
        id: 'u_blue_trial',
        title: 'U 彩蓝光',
        assetKey: 'card_back.default',
        owned: false,
        selected: false,
        source: 'ad_trial',
        expiresAt: null
      }
    ];
  }
}
