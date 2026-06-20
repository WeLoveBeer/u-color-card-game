export type RecentRoomStatus = 'waiting' | 'playing' | 'finished';

export type RecentRoom = {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  status: RecentRoomStatus;
  lastJoinedAt: string;
};

export type JoinRoomViewModel = {
  title: '加入房间';
  input: {
    value: string;
    placeholder: '输入房号';
    maxLength: number;
    valid: boolean;
    error: string | null;
  };
  primaryButton: {
    action: 'join_room';
    title: '加入房间';
    disabled: boolean;
  };
  recentRooms: Array<RecentRoom & { statusText: string; action: 'rejoin_room' }>;
  emptyText: string | null;
};

export class JoinRoomView {
  build(roomIdInput = '', recentRooms: RecentRoom[] = []): JoinRoomViewModel {
    const normalized = this.normalize(roomIdInput);
    const error = normalized.length === 0 || this.isValid(normalized) ? null : '房号格式不正确';
    return {
      title: '加入房间',
      input: {
        value: normalized,
        placeholder: '输入房号',
        maxLength: 12,
        valid: this.isValid(normalized),
        error
      },
      primaryButton: {
        action: 'join_room',
        title: '加入房间',
        disabled: !this.isValid(normalized)
      },
      recentRooms: recentRooms.map((room) => ({
        ...room,
        statusText: this.statusText(room.status),
        action: 'rejoin_room'
      })),
      emptyText: recentRooms.length === 0 ? '还没有最近房间，可以输入好友分享的房间号' : null
    };
  }

  private normalize(input: string): string {
    return input.trim().toUpperCase();
  }

  private isValid(roomId: string): boolean {
    return /^[A-Z0-9]{4,12}$/.test(roomId);
  }

  private statusText(status: RecentRoomStatus): string {
    if (status === 'waiting') {
      return '等待中';
    }
    if (status === 'playing') {
      return '对局中';
    }
    return '已结束';
  }
}
