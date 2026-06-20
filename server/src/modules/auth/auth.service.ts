import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { UserProfileDto, WechatLoginResponse } from '@shared/protocol/http.js';
import { PrismaService } from '../../common/prisma.service.js';
import { env } from '../../common/env.js';

@Injectable()
export class AuthService {
  private readonly users = new Map<string, UserProfileDto>();
  private readonly sessions = new Map<string, { userId: string; expiresAt: number }>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loginWithWechatCode(code: string): Promise<WechatLoginResponse> {
    const session = await this.resolveWechatSession(code);
    const openidHash = this.hash(session.openid);
    const id = `u_${openidHash.slice(0, 16)}`;
    const user = this.prisma.enabled
      ? await this.upsertPersistentUser(id, openidHash)
      : this.upsertMemoryUser(id, openidHash);
    const token = this.issueToken();
    const expiresAt = new Date(Date.now() + env.authTokenTtlDays * 24 * 60 * 60 * 1000);

    if (this.prisma.enabled) {
      await (this.prisma as any).authSession.create({
        data: {
          tokenHash: this.hash(token),
          userId: user.id,
          openidHash,
          sessionKeyHash: session.sessionKey ? this.hash(session.sessionKey) : null,
          expiresAt
        }
      });
    } else {
      this.sessions.set(this.hash(token), { userId: user.id, expiresAt: expiresAt.getTime() });
    }
    return { token, user };
  }

  async resolveToken(token?: string): Promise<string | null> {
    if (!token) {
      return null;
    }
    if (token.startsWith('dev-token:')) {
      const userId = token.slice('dev-token:'.length);
      return (await this.getUser(userId)) ? userId : null;
    }
    const tokenHash = this.hash(token);
    if (this.prisma.enabled) {
      const session = await (this.prisma as any).authSession.findUnique({ where: { tokenHash } });
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      return session.userId;
    }
    const session = this.sessions.get(tokenHash);
    return session && session.expiresAt > Date.now() ? session.userId : null;
  }

  async getUser(userId: string): Promise<UserProfileDto | null> {
    if (this.prisma.enabled) {
      const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
      return user ? this.toDto(user) : null;
    }
    return this.users.get(userId) ?? null;
  }

  async listUsers(): Promise<UserProfileDto[]> {
    if (this.prisma.enabled) {
      const users = await (this.prisma as any).user.findMany({
        orderBy: [{ coin: 'desc' }, { createdAt: 'asc' }],
        take: 100
      });
      return users.map((user: unknown) => this.toDto(user));
    }
    return [...this.users.values()];
  }

  async addCoin(userId: string, coinDelta: number): Promise<UserProfileDto | null> {
    if (this.prisma.enabled) {
      const updated = await (this.prisma as any).user.update({
        where: { id: userId },
        data: { coin: { increment: coinDelta } }
      }).catch(() => null);
      if (!updated) {
        return null;
      }
      if (updated.coin < 0) {
        return this.setCoin(userId, 0);
      }
      return this.toDto(updated);
    }
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, coin: Math.max(0, user.coin + coinDelta) };
    this.users.set(userId, next);
    return next;
  }

  async selectCardBack(userId: string, selectedCardBackId: string): Promise<UserProfileDto | null> {
    if (this.prisma.enabled) {
      const updated = await (this.prisma as any).user.update({
        where: { id: userId },
        data: { selectedCardBack: selectedCardBackId }
      }).catch(() => null);
      return updated ? this.toDto(updated) : null;
    }
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, selectedCardBackId };
    this.users.set(userId, next);
    return next;
  }

  private async setCoin(userId: string, coin: number): Promise<UserProfileDto | null> {
    const updated = await (this.prisma as any).user.update({ where: { id: userId }, data: { coin } }).catch(() => null);
    return updated ? this.toDto(updated) : null;
  }

  private async upsertPersistentUser(id: string, openidHash: string): Promise<UserProfileDto> {
    const user = await (this.prisma as any).user.upsert({
      where: { openidHash },
      update: {},
      create: {
        id,
        openidHash,
        nickname: '玩家',
        avatar: '',
        coin: 1000,
        selectedCardBack: 'default',
        cardBacks: {
          create: {
            cardBackId: 'default',
            source: 'default'
          }
        }
      }
    });
    return this.toDto(user);
  }

  private upsertMemoryUser(id: string, openidHash: string): UserProfileDto {
    const user =
      this.users.get(id) ??
      {
        id,
        openidHash,
        nickname: '玩家',
        avatar: '',
        coin: 1000,
        selectedCardBackId: 'default'
      };
    this.users.set(id, user);
    return user;
  }

  private async resolveWechatSession(code: string): Promise<{ openid: string; sessionKey?: string }> {
    if (!env.wechatAppId || !env.wechatAppSecret) {
      return { openid: `dev:${code}` };
    }
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', env.wechatAppId);
    url.searchParams.set('secret', env.wechatAppSecret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');
    const response = await fetch(url);
    const payload = (await response.json()) as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !payload.openid) {
      throw new Error(payload.errmsg ?? 'WECHAT_CODE2SESSION_FAILED');
    }
    return { openid: payload.openid, sessionKey: payload.session_key };
  }

  private issueToken(): string {
    const body = randomBytes(24).toString('base64url');
    const signature = this.hash(`${body}.${env.jwtSecret}`);
    return `wx-token:${body}.${signature}`;
  }

  private toDto(value: unknown): UserProfileDto {
    const user = value as {
      id: string;
      openidHash?: string;
      nickname: string;
      avatar: string;
      coin: number;
      selectedCardBack?: string;
      selectedCardBackId?: string;
    };
    return {
      id: user.id,
      openidHash: user.openidHash,
      nickname: user.nickname,
      avatar: user.avatar,
      coin: Math.max(0, user.coin),
      selectedCardBackId: user.selectedCardBack ?? user.selectedCardBackId ?? 'default'
    };
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
