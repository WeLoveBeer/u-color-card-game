import { Inject, Injectable } from '@nestjs/common';
import type { RuleConfig } from '@shared/domain/rule-config.js';
import type { CreateRoomResponse } from '@shared/protocol/http.js';
import { DEFAULT_RULE_CONFIG } from '@shared/domain/rule-config.js';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';
import { env } from '../../common/env.js';
import type { RoomRuntimeState } from './room.types.js';

@Injectable()
export class RoomService {
  private readonly rooms = new Map<string, RoomRuntimeState>();
  private readonly playerRooms = new Map<string, string>();

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async createRoom(ownerId: string, config: RuleConfig = DEFAULT_RULE_CONFIG): Promise<CreateRoomResponse> {
    const roomId = await this.createRoomId();
    const room: RoomRuntimeState = {
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
    };
    await this.saveRoom(room);
    await this.mapPlayer(ownerId, roomId);
    if (this.prisma.enabled) {
      await (this.prisma as any).room.create({
        data: { id: roomId, ownerId, status: 'waiting', config }
      });
    }
    return { roomId, wsUrl: env.publicWsUrl };
  }

  async getRoom(roomId: string): Promise<RoomRuntimeState | null> {
    if (this.redis.enabled) {
      const raw = await this.redis.client.get(this.roomKey(roomId));
      return raw ? (JSON.parse(raw) as RoomRuntimeState) : null;
    }
    return this.rooms.get(roomId) ?? null;
  }

  async joinRoom(roomId: string, playerId: string): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
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
    await this.saveRoom(room);
    await this.mapPlayer(playerId, roomId);
    return room;
  }

  async leaveRoom(roomId: string, playerId: string): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return null;
    }
    if (room.status === 'waiting') {
      room.players = room.players
        .filter((player) => player.id !== playerId)
        .map((player, index) => ({ ...player, seatIndex: index }));
      await this.unmapPlayer(playerId);
      if (room.ownerId === playerId || room.players.length === 0) {
        for (const player of room.players) {
          await this.unmapPlayer(player.id);
        }
        await this.deleteRoom(roomId);
        return null;
      }
      await this.saveRoom(room);
      return room;
    }
    return this.markOffline(roomId, playerId, Date.now() + 15000);
  }

  async setReady(roomId: string, playerId: string, ready: boolean): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.ready = ready;
    await this.saveRoom(room);
    return room;
  }

  async markPlaying(roomId: string): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return null;
    }
    room.status = 'playing';
    await this.saveRoom(room);
    if (this.prisma.enabled) {
      await (this.prisma as any).room.update({ where: { id: roomId }, data: { status: 'playing', startedAt: new Date() } }).catch(() => null);
    }
    return room;
  }

  async findRoomByPlayer(playerId: string): Promise<RoomRuntimeState | null> {
    const roomId = this.redis.enabled ? await this.redis.client.get(this.playerKey(playerId)) : this.playerRooms.get(playerId);
    return roomId ? this.getRoom(roomId) : null;
  }

  async markOffline(roomId: string, playerId: string, autoPlayAt: number): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.online = false;
    player.disconnectAt = Date.now();
    player.autoPlayAt = autoPlayAt;
    await this.saveRoom(room);
    return room;
  }

  async markReconnected(roomId: string, playerId: string): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player) {
      return null;
    }
    player.online = true;
    player.isAutoPlaying = false;
    player.disconnectAt = null;
    player.autoPlayAt = null;
    await this.saveRoom(room);
    await this.mapPlayer(playerId, roomId);
    return room;
  }

  async markAutoPlaying(roomId: string, playerId: string): Promise<RoomRuntimeState | null> {
    const room = await this.getRoom(roomId);
    const player = room?.players.find((item) => item.id === playerId);
    if (!room || !player || player.online) {
      return null;
    }
    player.isAutoPlaying = true;
    await this.saveRoom(room);
    return room;
  }

  private async createRoomId(): Promise<string> {
    let id = '';
    do {
      id = String(Math.floor(100000 + Math.random() * 900000));
    } while (await this.getRoom(id));
    return id;
  }

  private async saveRoom(room: RoomRuntimeState): Promise<void> {
    if (this.redis.enabled) {
      await this.redis.client.set(this.roomKey(room.roomId), JSON.stringify(room), 'EX', 60 * 60 * 6);
      return;
    }
    this.rooms.set(room.roomId, room);
  }

  private async deleteRoom(roomId: string): Promise<void> {
    if (this.redis.enabled) {
      await this.redis.client.del(this.roomKey(roomId));
    } else {
      this.rooms.delete(roomId);
    }
    if (this.prisma.enabled) {
      await (this.prisma as any).room.update({ where: { id: roomId }, data: { status: 'finished', endedAt: new Date() } }).catch(() => null);
    }
  }

  private async mapPlayer(playerId: string, roomId: string): Promise<void> {
    if (this.redis.enabled) {
      await this.redis.client.set(this.playerKey(playerId), roomId, 'EX', 60 * 60 * 6);
      return;
    }
    this.playerRooms.set(playerId, roomId);
  }

  private async unmapPlayer(playerId: string): Promise<void> {
    if (this.redis.enabled) {
      await this.redis.client.del(this.playerKey(playerId));
      return;
    }
    this.playerRooms.delete(playerId);
  }

  private roomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private playerKey(playerId: string): string {
    return `room:player:${playerId}`;
  }
}
