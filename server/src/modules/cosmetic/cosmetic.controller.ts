import { Body, Controller, Get, Headers, Inject, Post } from '@nestjs/common';
import type {
  ApiResponse,
  CardBackItemDto,
  CardBackListResponse,
  SelectCardBackRequest,
  SelectCardBackResponse
} from '@shared/protocol/http.js';
import { PrismaService } from '../../common/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('cosmetics')
export class CosmeticController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Get('card-backs')
  async cardBacks(@Headers('authorization') authorization?: string): Promise<ApiResponse<CardBackListResponse>> {
    const userId = await this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const user = await this.auth.getUser(userId);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const selectedCardBackId = user.selectedCardBackId ?? 'default';
    return {
      success: true,
      data: {
        selectedCardBackId,
        items: await this.cardBackItems(userId, selectedCardBackId)
      }
    };
  }

  @Post('card-backs/select')
  async selectCardBack(
    @Body() body: SelectCardBackRequest,
    @Headers('authorization') authorization?: string
  ): Promise<ApiResponse<SelectCardBackResponse>> {
    const userId = await this.resolveUserId(authorization);
    if (!userId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const user = await this.auth.getUser(userId);
    if (!user) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未登录或 token 失效' } };
    }
    const candidate = (await this.cardBackItems(userId, user.selectedCardBackId ?? 'default')).find((item) => item.id === body.cardBackId);
    if (!candidate || !candidate.owned) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '牌背未拥有或不存在' } };
    }
    const updated = await this.auth.selectCardBack(userId, body.cardBackId);
    const selectedCardBackId = updated?.selectedCardBackId ?? body.cardBackId;
    return {
      success: true,
      data: {
        selectedCardBackId,
        items: await this.cardBackItems(userId, selectedCardBackId)
      }
    };
  }

  private resolveUserId(authorization?: string): Promise<string | null> {
    return this.auth.resolveToken(authorization?.replace('Bearer ', ''));
  }

  private async cardBackItems(userId: string, selectedCardBackId: string): Promise<CardBackItemDto[]> {
    const catalog: CardBackItemDto[] = [
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
    if (!this.prisma.enabled) {
      return catalog;
    }
    const owns = await (this.prisma as any).userCardBack.findMany({ where: { userId } });
    const owned = new Map<string, { source: CardBackItemDto['source']; expiresAt?: Date | null }>(
      owns.map((item: { cardBackId: string; source: CardBackItemDto['source']; expiresAt?: Date | null }) => [
        item.cardBackId,
        { source: item.source, expiresAt: item.expiresAt }
      ])
    );
    return catalog.map((item) => {
      const ownedItem = owned.get(item.id);
      const isOwned = item.id === 'default' || Boolean(ownedItem && (!ownedItem.expiresAt || ownedItem.expiresAt > new Date()));
      return {
        ...item,
        owned: isOwned,
        selected: selectedCardBackId === item.id,
        source: ownedItem?.source ?? item.source,
        expiresAt: ownedItem?.expiresAt?.toISOString() ?? item.expiresAt ?? null
      };
    });
  }
}
