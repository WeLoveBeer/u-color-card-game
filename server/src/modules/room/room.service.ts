import { Injectable } from '@nestjs/common';
import type { RuleConfig } from '@shared/domain/rule-config.js';
import type { CreateRoomResponse } from '@shared/protocol/http.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import type { RoomRuntimeState } from './room.types.js';

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, RoomRuntimeState>();

  createRoom(ownerId: string, config: RuleConfig = DEFAULT_RULE_CONFIG): CreateRoomResponse {
    const roomId = this.createRoomId();
    this.rooms.set(roomId, {
      roomId,
      ownerId,
      status: 'waiting',
      config,
      players: [{ id: ownerId, ready: true, seatIndex: 0, online: true, isAi: false }]
    });
    return { roomId, wsUrl: 'ws://localhost:3000/ws' };
  }

  getRoom(roomId: string): RoomRuntimeState | null {
    return this.rooms.get(roomId) ?? null;
  }

  joinRoom(roomId: string, playerId: string): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') {
      return null;
    }
    if (!room.players.some((player) => player.id === playerId)) {
      room.players.push({
        id: playerId,
        ready: false,
        seatIndex: room.players.length,
        online: true,
        isAi: false
      });
    }
    return room;
  }

  setReady(roomId: string, playerId: string, ready: boolean): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.ready = ready;
    return room;
  }

  markPlaying(roomId: string): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    room.status = 'playing';
    return room;
  }

  private createRoomId(): string {
    let id = '';
    do {
      id = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.rooms.has(id));
    return id;
  }
}
