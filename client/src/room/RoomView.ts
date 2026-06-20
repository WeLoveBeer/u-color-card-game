import type { RoomStateMessage } from '@shared/index.js';

export type RoomSeatViewModel = {
  id: string | null;
  seatIndex: number;
  label: string;
  ready: boolean;
  online: boolean;
  isAi: boolean;
  empty: boolean;
  owner: boolean;
  badge: string | null;
};

export type RoomViewModel = {
  roomId: string;
  viewerRole: 'owner' | 'guest';
  status: RoomStateMessage['data']['status'];
  seats: RoomSeatViewModel[];
  ruleSummary: string;
  quickMessages: string[];
  actions: Array<{ action: 'copy_room_id' | 'share_room' | 'leave_room'; title: string }>;
  primaryButton: {
    action: 'start_game' | 'ready' | 'cancel_ready';
    title: string;
    disabled: boolean;
    reason: string | null;
  };
};

export class RoomView {
  build(room: RoomStateMessage['data'], viewerId: string): RoomViewModel {
    return {
      roomId: room.roomId,
      viewerRole: room.ownerId === viewerId ? 'owner' : 'guest',
      status: room.status,
      seats: this.seats(room),
      ruleSummary: this.ruleSummary(room),
      quickMessages: ['我准备好了', '快开始吧', '这把真随机', '手气来了'],
      actions: [
        { action: 'copy_room_id', title: '复制房号' },
        { action: 'share_room', title: '分享' },
        { action: 'leave_room', title: '退出房间' }
      ],
      primaryButton: this.primaryButton(room, viewerId)
    };
  }

  seats(room: RoomStateMessage['data']): RoomSeatViewModel[] {
    const playersBySeat = new Map(room.players.map((player) => [player.seatIndex, player]));
    return Array.from({ length: room.config.playerCount }, (_, seatIndex) => {
      const player = playersBySeat.get(seatIndex);
      if (!player) {
        return {
          id: null,
          seatIndex,
          label: '邀请好友',
          ready: false,
          online: false,
          isAi: false,
          empty: true,
          owner: false,
          badge: '空位'
        };
      }
      return {
        id: player.id,
        seatIndex: player.seatIndex,
        label: player.isAi ? 'AI 对手' : player.nickname ?? player.id,
        ready: Boolean(player.ready),
        online: player.online,
        isAi: player.isAi,
        empty: false,
        owner: player.id === room.ownerId,
        badge: this.badgeForPlayer(player.id === room.ownerId, Boolean(player.ready), player.online, player.isAutoPlaying)
      };
    });
  }

  startButtonText(room: RoomStateMessage['data'], viewerId: string): string {
    return this.primaryButton(room, viewerId).title;
  }

  private primaryButton(room: RoomStateMessage['data'], viewerId: string): RoomViewModel['primaryButton'] {
    if (room.ownerId !== viewerId) {
      const viewer = room.players.find((player) => player.id === viewerId);
      return {
        action: viewer?.ready ? 'cancel_ready' : 'ready',
        title: viewer?.ready ? '取消准备' : '准备',
        disabled: room.status !== 'waiting',
        reason: room.status === 'waiting' ? null : '房间已开始'
      };
    }
    if (room.players.length < room.config.playerCount && room.config.aiFill) {
      return { action: 'start_game', title: '开始并补 AI', disabled: false, reason: null };
    }
    if (room.players.length < room.config.playerCount) {
      return { action: 'start_game', title: '等待玩家加入', disabled: true, reason: '人数不足' };
    }
    if (room.players.some((player) => player.id !== room.ownerId && !player.isAi && !player.ready)) {
      return { action: 'start_game', title: '等待准备', disabled: true, reason: '仍有玩家未准备' };
    }
    return { action: 'start_game', title: '开始游戏', disabled: room.status !== 'waiting', reason: room.status === 'waiting' ? null : '房间已开始' };
  }

  private ruleSummary(room: RoomStateMessage['data']): string {
    return `${room.config.playerCount}人 · ${room.config.initialCards}张起手 · ${room.config.turnSeconds}秒 · ${room.config.ruleSet === 'party' ? '欢乐规则' : '标准规则'}`;
  }

  private badgeForPlayer(owner: boolean, ready: boolean, online: boolean, autoPlaying: boolean): string | null {
    if (autoPlaying) {
      return '托管';
    }
    if (!online) {
      return '离线';
    }
    if (owner) {
      return '房主';
    }
    return ready ? '已准备' : '未准备';
  }
}
