import { Injectable } from '@nestjs/common';
import type { RuleConfig } from '@shared/domain/rule-config.js';
import type { CreateRoomResponse } from '@shared/protocol/http.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import type { RoomRuntimeState } from './room.types.js';

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, RoomRuntimeState>();
  private readonly playerRooms = new Map<string, string>();

  createRoom(ownerId: string, config: RuleConfig = DEFAULT_RULE_CONFIG): CreateRoomResponse {
    const roomId = this.createRoomId();
    this.rooms.set(roomId, {
      roomId,
      ownerId,
      status: 'waiting',
      config,
      players: [
        {
          id: ownerId,
          ready: true,
          seatIndex: 0,
          online: true,
          isAi: false,
          isAutoPlaying: false,
          disconnectAt: null,
          autoPlayAt: null
        }
      ]
    });
    this.playerRooms.set(ownerId, roomId);
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
        isAi: false,
        isAutoPlaying: false,
        disconnectAt: null,
        autoPlayAt: null
      });
    }
    this.playerRooms.set(playerId, roomId);
    return room;
  }

  leaveRoom(roomId: string, playerId: string): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    if (room.status === 'waiting') {
      room.players = room.players
        .filter((player) => player.id !== playerId)
        .map((player, index) => ({ ...player, seatIndex: index }));
      this.playerRooms.delete(playerId);
      if (room.ownerId === playerId || room.players.length === 0) {
        this.rooms.delete(roomId);
        for (const player of room.players) {
          this.playerRooms.delete(player.id);
        }
        return null;
      }
      return room;
    }
    return this.markOffline(roomId, playerId, Date.now() + 15000);
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

  findRoomByPlayer(playerId: string): RoomRuntimeState | null {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.getRoom(roomId) : null;
  }

  markOffline(roomId: string, playerId: string, autoPlayAt: number): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.online = false;
    player.disconnectAt = Date.now();
    player.autoPlayAt = autoPlayAt;
    return room;
  }

  markReconnected(roomId: string, playerId: string): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.online = true;
    player.isAutoPlaying = false;
    player.disconnectAt = null;
    player.autoPlayAt = null;
    this.playerRooms.set(playerId, roomId);
    return room;
  }

  markAutoPlaying(roomId: string, playerId: string): RoomRuntimeState | null {
    const room = this.rooms.get(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player || player.online) {
      return null;
    }
    player.isAutoPlaying = true;
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
