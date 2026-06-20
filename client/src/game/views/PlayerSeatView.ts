import type { PlayerState } from '@shared/index.js';

export type PlayerSeatViewModel = {
  playerId: string;
  seatIndex: number;
  handCount: number;
  current: boolean;
  offline: boolean;
  autoPlaying: boolean;
};

export class PlayerSeatView {
  build(player: PlayerState, currentPlayerId: string): PlayerSeatViewModel {
    return {
      playerId: player.id,
      seatIndex: player.seatIndex,
      handCount: player.handCount,
      current: player.id === currentPlayerId,
      offline: !player.online,
      autoPlaying: player.isAutoPlaying
    };
  }
}
