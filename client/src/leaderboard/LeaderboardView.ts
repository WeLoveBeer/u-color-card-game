import type { CoinLeaderboardResponse } from '@shared/index.js';

export class LeaderboardView {
  build(data: CoinLeaderboardResponse) {
    return {
      podium: data.items.slice(0, 3),
      list: data.items.slice(3),
      me: data.me,
      empty: data.items.length === 0
    };
  }
}
