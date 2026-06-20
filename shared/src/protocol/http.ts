import type { RuleConfig } from '../domain/rule-config.js';
import type { ApiError } from './errors.js';

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type UserProfileDto = {
  id: string;
  openidHash?: string;
  nickname: string;
  avatar: string;
  coin: number;
  selectedCardBackId?: string;
};

export type WechatLoginRequest = {
  code: string;
};

export type WechatLoginResponse = {
  token: string;
  user: UserProfileDto;
};

export type AppConfigResponse = {
  minClientVersion: string;
  adEnabled: boolean;
  defaultRoomConfig: RuleConfig;
};

export type CreateRoomRequest = RuleConfig;

export type CreateRoomResponse = {
  roomId: string;
  wsUrl: string;
};

export type LeaderboardItemDto = {
  rank: number;
  userId: string;
  nickname: string;
  avatar: string;
  coin: number;
};

export type CoinLeaderboardResponse = {
  items: LeaderboardItemDto[];
  me?: LeaderboardItemDto;
  updatedAt: string;
};

export type AdRewardRequest = {
  rewardType: 'daily_coin' | 'settlement_double' | 'card_back_trial';
  adUnitId?: string;
};

export type AdRewardResponse = {
  rewardType: AdRewardRequest['rewardType'];
  coinDelta: number;
  currentCoin: number;
  todayClaimed: number;
  todayLimit: number;
};
