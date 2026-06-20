import type { RuleConfig } from '@shared/domain/rule-config.js';

export type RoomRuntimeState = {
  roomId: string;
  ownerId: string;
  status: 'waiting' | 'playing' | 'finished';
  config: RuleConfig;
  players: Array<{
    id: string;
    ready: boolean;
    seatIndex: number;
    online: boolean;
    isAi: boolean;
    isAutoPlaying?: boolean;
    disconnectAt?: number | null;
    autoPlayAt?: number | null;
  }>;
};
