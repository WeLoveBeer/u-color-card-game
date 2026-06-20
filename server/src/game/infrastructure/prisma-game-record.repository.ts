import type { GameState } from '@shared/domain/game-state.js';
import type { GameActionLog, GameRecordRepository } from './game-record.repository.js';
import { PrismaService } from '../../common/prisma.service.js';

export class PrismaGameRecordRepository implements GameRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendAction(log: GameActionLog): Promise<void> {
    await this.prisma.gameAction.create({
      data: {
        gameId: log.roomId,
        playerId: log.playerId,
        actionType: log.actionType,
        actionPayload: log.actionPayload as object,
        stateVersion: log.stateVersion
      }
    });
  }

  async saveFinishedGame(state: GameState): Promise<void> {
    const winner = state.players.find((player) => (state.hands[player.id] ?? []).length === 0);
    await this.prisma.gameRecord.create({
      data: {
        id: state.gameId,
        roomId: state.roomId,
        ruleConfig: state.ruleConfig as object,
        players: state.players as object,
        rankings: [] as object,
        winnerId: winner?.id,
        seedHash: state.seedHash,
        startedAt: new Date(),
        endedAt: new Date()
      }
    });
  }
}
