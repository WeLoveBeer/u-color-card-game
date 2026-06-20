import type { CoinDelta, GameOverMessage, PlayerId, Ranking } from '@shared/index.js';

export type ResultMode = 'ai' | 'friend_room';

export type ResultRankItemViewModel = {
  playerId: PlayerId;
  rank: number;
  remainCardCount: number;
  score: number;
  coinDelta: number;
  coinAfter: number | null;
  currentUser: boolean;
  winner: boolean;
};

export type ResultViewModel = {
  title: '胜利' | '失败';
  subtitle: string;
  winnerId: PlayerId;
  rankings: ResultRankItemViewModel[];
  rewardSummary: {
    coinDelta: number;
    coinAfter: number | null;
  };
  actions: Array<{ action: 'play_again' | 'back_lobby' | 'share' | 'leaderboard' | 'ad_double' | 'next_round' | 'back_room'; title: string; primary: boolean }>;
  fairness: {
    title: '本局由服务端随机洗牌';
    subtitle: '无控牌机制';
    gameId: string;
    seedHash: string;
    action: 'rules';
  };
};

export class ResultView {
  build(message: GameOverMessage['data'], viewerId: PlayerId, mode: ResultMode = 'ai'): ResultViewModel {
    const currentUserWon = message.winnerId === viewerId;
    const rankings = this.rankings(message.rankings, message.coinDeltas, viewerId, message.winnerId);
    const myRank = rankings.find((item) => item.currentUser);
    return {
      title: currentUserWon ? '胜利' : '失败',
      subtitle: currentUserWon ? '你率先打完了所有手牌' : `本局第 ${myRank?.rank ?? '-'} 名`,
      winnerId: message.winnerId,
      rankings,
      rewardSummary: {
        coinDelta: myRank?.coinDelta ?? 0,
        coinAfter: myRank?.coinAfter ?? null
      },
      actions: this.actions(mode),
      fairness: {
        title: '本局由服务端随机洗牌',
        subtitle: '无控牌机制',
        gameId: message.gameId,
        seedHash: message.seedHash,
        action: 'rules'
      }
    };
  }

  private rankings(rankings: Ranking[], coinDeltas: CoinDelta[], viewerId: PlayerId, winnerId: PlayerId): ResultRankItemViewModel[] {
    const coinByPlayer = new Map(coinDeltas.map((delta) => [delta.playerId, delta]));
    return [...rankings]
      .sort((a, b) => a.rank - b.rank)
      .map((ranking) => {
        const coin = coinByPlayer.get(ranking.playerId);
        return {
          playerId: ranking.playerId,
          rank: ranking.rank,
          remainCardCount: ranking.remainCardCount,
          score: ranking.score,
          coinDelta: coin?.coinDelta ?? 0,
          coinAfter: coin?.coinAfter ?? null,
          currentUser: ranking.playerId === viewerId,
          winner: ranking.playerId === winnerId
        };
      });
  }

  private actions(mode: ResultMode): ResultViewModel['actions'] {
    const common: ResultViewModel['actions'] = [
      { action: 'play_again', title: '再来一局', primary: true },
      { action: 'back_lobby', title: '返回大厅', primary: false },
      { action: 'share', title: '分享战绩', primary: false },
      { action: 'leaderboard', title: '查看排行榜', primary: false }
    ];
    if (mode === 'ai') {
      return [...common, { action: 'ad_double', title: '看广告双倍金币', primary: false }];
    }
    return [
      { action: 'next_round', title: '继续下一局', primary: true },
      { action: 'back_room', title: '返回房间', primary: false },
      ...common.filter((action) => action.action !== 'play_again')
    ];
  }
}
