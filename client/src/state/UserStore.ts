import type { UserProfileDto } from '@shared/index.js';

export class UserStore {
  private tokenValue: string | null = null;
  private userValue: UserProfileDto | null = null;

  setSession(token: string, user: UserProfileDto): void {
    this.tokenValue = token;
    this.userValue = user;
  }

  setUser(user: UserProfileDto): void {
    this.userValue = user;
  }

  clear(): void {
    this.tokenValue = null;
    this.userValue = null;
  }

  get token(): string | null {
    return this.tokenValue;
  }

  get user(): UserProfileDto | null {
    return this.userValue;
  }
}
