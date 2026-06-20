import type { RoomStateMessage } from '@shared/index.js';

export type RoomSeatViewModel = {
  id: string;
  seatIndex: number;
  label: string;
  ready: boolean;
  online: boolean;
  isAi: boolean;
};

export class RoomView {
  seats(room: RoomStateMessage['data']): RoomSeatViewModel[] {
    return room.players.map((player) => ({
      id: player.id,
      seatIndex: player.seatIndex,
      label: player.isAi ? 'AI 对手' : player.nickname ?? player.id,
      ready: Boolean(player.ready),
      online: player.online,
      isAi: player.isAi
    }));
  }

  startButtonText(room: RoomStateMessage['data'], viewerId: string): string {
    if (room.ownerId !== viewerId) {
      return '准备';
    }
    if (room.players.length < room.config.playerCount && room.config.aiFill) {
      return '开始并补 AI';
    }
    return '开始游戏';
  }
}
