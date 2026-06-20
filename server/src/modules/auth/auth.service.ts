import { Injectable } from '@nestjs/common';
import type { UserProfileDto, WechatLoginResponse } from '@shared/protocol/http.js';

@Injectable()
export class AuthService {
  private readonly users = new Map<string, UserProfileDto>();

  loginWithWechatCode(code: string): WechatLoginResponse {
    const id = `u_${this.hash(code).slice(0, 10)}`;
    const user: UserProfileDto =
      this.users.get(id) ??
      {
        id,
        openidHash: this.hash(`openid:${code}`),
        nickname: '玩家',
        avatar: '',
        coin: 1000,
        selectedCardBackId: 'default'
      };
    this.users.set(id, user);
    return { token: `dev-token:${id}`, user };
  }

  resolveToken(token?: string): string | null {
    if (!token?.startsWith('dev-token:')) {
      return null;
    }
    return token.slice('dev-token:'.length);
  }

  getUser(userId: string): UserProfileDto | null {
    return this.users.get(userId) ?? null;
  }

  listUsers(): UserProfileDto[] {
    return [...this.users.values()];
  }

  addCoin(userId: string, coinDelta: number): UserProfileDto | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, coin: Math.max(0, user.coin + coinDelta) };
    this.users.set(userId, next);
    return next;
  }

  selectCardBack(userId: string, selectedCardBackId: string): UserProfileDto | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, selectedCardBackId };
    this.users.set(userId, next);
    return next;
  }

  private hash(input: string): string {
    let value = 0;
    for (const char of input) {
      value = (value * 31 + char.charCodeAt(0)) >>> 0;
    }
    return value.toString(16).padStart(8, '0');
  }
}
