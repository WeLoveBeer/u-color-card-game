import type { Card } from '@shared/domain/card.js';
import type { CoinDelta, GameState, PlayerId, Ranking } from '@shared/domain/game-state.js';
import { getHand } from '../utils/state.js';

export class ScoreResolver {
  cardScore(card: Card): number {
    if (card.type === 'number') {
      return Number(card.value ?? 0);
    }
    if (card.type === 'wild_color' || card.type === 'wild_plus_four') {
      return 50;
    }
    return 20;
  }

  handScore(hand: Card[]): number {
    return hand.reduce((sum, card) => sum + this.cardScore(card), 0);
  }

  buildRankings(state: GameState, winnerId: PlayerId): Ranking[] {
    const rankings = state.players.map((player) => ({
      playerId: player.id,
      rank: player.id === winnerId ? 1 : 0,
      remainCardCount: getHand(state, player.id).length,
      score: this.handScore(getHand(state, player.id))
    }));

    const losers = rankings
      .filter((ranking) => ranking.playerId !== winnerId)
      .sort((a, b) => a.score - b.score || a.remainCardCount - b.remainCardCount);

    return [
      rankings.find((ranking) => ranking.playerId === winnerId)!,
      ...losers.map((ranking, index) => ({ ...ranking, rank: index + 2 }))
    ];
  }

  buildCoinDeltas(state: GameState, winnerId: PlayerId, coinBalances: Record<PlayerId, number> = {}): CoinDelta[] {
    let winnerGain = 0;
    const deltas: CoinDelta[] = [];

    for (const player of state.players) {
      if (player.id === winnerId) {
        continue;
      }
      const balance = coinBalances[player.id] ?? Number.MAX_SAFE_INTEGER;
      const loss = Math.min(this.handScore(getHand(state, player.id)), balance);
      winnerGain += loss;
      deltas.push({ playerId: player.id, coinDelta: -loss, coinAfter: Math.max(0, balance - loss) });
    }

    const winnerBalance = coinBalances[winnerId] ?? 0;
    deltas.unshift({ playerId: winnerId, coinDelta: winnerGain, coinAfter: winnerBalance + winnerGain });
    return deltas;
  }
}
