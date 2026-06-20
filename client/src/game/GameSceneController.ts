import type { VisibleGameState } from '@shared/index.js';
import { GameStore } from '../state/GameStore.js';

export type GameSceneViewModel = {
  state: VisibleGameState | null;
  playableCardIds: string[];
  prompt: string;
};

export class GameSceneController {
  constructor(private readonly store: GameStore) {}

  build(playerId: string): GameSceneViewModel {
    const state = this.store.state;
    return {
      state,
      playableCardIds: this.store.playableCardIds(),
      prompt: state?.currentPlayerId === playerId ? '轮到你出牌' : '等待对手出牌'
    };
  }
}
