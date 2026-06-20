import type { Card, CardId, PlayableColor, PlayerState, VisibleGameState } from '@shared/index.js';
import { GameStore } from '../state/GameStore.js';
import { DirectionRingView, type DirectionRingViewModel } from './views/DirectionRingView.js';
import { DiscardPileView } from './views/DiscardPileView.js';
import { HandCardView } from './views/HandCardView.js';
import { PlayerSeatView, type PlayerSeatViewModel } from './views/PlayerSeatView.js';
import type { CardViewModel } from './views/CardView.js';

export type GameSceneViewModel = {
  state: VisibleGameState | null;
  playableCardIds: string[];
  prompt: string;
  topActions: Array<{ action: 'rules' | 'settings'; title: string; iconKey: string }>;
  table: {
    deck: DeckViewModel | null;
    discard: CardViewModel | null;
    directionRing: DirectionRingViewModel | null;
    actionTip: string | null;
  };
  seats: PlayerSeatLayoutViewModel[];
  localPlayer: LocalPlayerPanelViewModel | null;
  hand: HandLayoutViewModel;
  colorPicker: ColorPickerViewModel | null;
};

export type GameSceneBuildOptions = {
  selectedCardId?: CardId | null;
  pendingColorCardId?: CardId | null;
};

export type DeckViewModel = {
  deckCount: number;
  highlighted: boolean;
  arrowVisible: boolean;
  confirmRequired: boolean;
};

export type PlayerSeatLayoutViewModel = PlayerSeatViewModel & {
  nickname: string;
  position: 'top' | 'left' | 'right' | 'bottom';
  badge: string | null;
};

export type LocalPlayerPanelViewModel = {
  playerId: string;
  handCount: number;
  current: boolean;
  timerLevel: 'normal' | 'warning' | 'danger';
  secondsLeft: number;
  callU: {
    title: '喊 U';
    enabled: boolean;
    hint: string;
  };
};

export type HandLayoutViewModel = {
  cards: CardViewModel[];
  scrollable: boolean;
  selectedCardId: CardId | null;
  playableOutsideHint: boolean;
};

export type ColorPickerViewModel = {
  cardId: CardId;
  title: '选择颜色';
  colors: Array<{ color: PlayableColor; title: string; recommended: boolean }>;
};

export class GameSceneController {
  private readonly handView = new HandCardView();
  private readonly playerSeatView = new PlayerSeatView();
  private readonly directionRingView = new DirectionRingView();
  private readonly discardPileView = new DiscardPileView();

  constructor(private readonly store: GameStore) {}

  build(playerId: string, options: GameSceneBuildOptions = {}): GameSceneViewModel {
    const state = this.store.state;
    const playableCardIds = this.store.playableCardIds();
    const selectedCardId = options.selectedCardId ?? null;
    return {
      state,
      playableCardIds,
      prompt: this.prompt(state, playerId, playableCardIds),
      topActions: [
        { action: 'rules', title: '规则', iconKey: 'icon.book' },
        { action: 'settings', title: '设置', iconKey: 'icon.settings' }
      ],
      table: {
        deck: state ? this.deck(state, playerId, playableCardIds) : null,
        discard: state ? this.discardPileView.build(state.discardTop) : null,
        directionRing: state ? this.directionRingView.build(state.direction, state.currentColor) : null,
        actionTip: this.actionTip(state, playerId)
      },
      seats: state ? this.seats(state, playerId) : [],
      localPlayer: state ? this.localPlayer(state, playerId) : null,
      hand: state ? this.hand(state.myHand, playableCardIds, selectedCardId) : { cards: [], scrollable: false, selectedCardId: null, playableOutsideHint: false },
      colorPicker: state && options.pendingColorCardId ? this.colorPicker(state.myHand, options.pendingColorCardId) : null
    };
  }

  private prompt(state: VisibleGameState | null, playerId: string, playableCardIds: string[]): string {
    if (!state) {
      return '正在进入牌局';
    }
    if (state.currentPlayerId !== playerId) {
      return '等待对手出牌';
    }
    if (playableCardIds.length === 0) {
      return '没有可出牌，点击牌堆摸牌';
    }
    return '轮到你出牌';
  }

  private actionTip(state: VisibleGameState | null, playerId: string): string | null {
    if (!state) {
      return null;
    }
    if (state.pendingDrawCount > 0 && state.currentPlayerId === playerId) {
      return `需要处理累计摸 ${state.pendingDrawCount} 张`;
    }
    if (state.currentPlayerId === playerId) {
      return '轮到你出牌';
    }
    return null;
  }

  private deck(state: VisibleGameState, playerId: string, playableCardIds: string[]): DeckViewModel {
    const isMyTurn = state.currentPlayerId === playerId;
    return {
      deckCount: state.deckCount,
      highlighted: isMyTurn && playableCardIds.length === 0,
      arrowVisible: isMyTurn && playableCardIds.length === 0,
      confirmRequired: isMyTurn && playableCardIds.length > 0
    };
  }

  private seats(state: VisibleGameState, playerId: string): PlayerSeatLayoutViewModel[] {
    const others = state.players
      .filter((player) => player.id !== playerId)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const positions = this.positionsFor(others.length);
    return others.map((player, index) => ({
      ...this.playerSeatView.build(player, state.currentPlayerId),
      nickname: this.nicknameFor(player, index),
      position: positions[index] ?? 'top',
      badge: this.playerBadge(player)
    }));
  }

  private localPlayer(state: VisibleGameState, playerId: string): LocalPlayerPanelViewModel | null {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return null;
    }
    const secondsLeft = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
    const canCallU = state.currentPlayerId === playerId && state.myHand.length === 2;
    return {
      playerId,
      handCount: state.myHand.length,
      current: state.currentPlayerId === playerId,
      timerLevel: this.timerLevel(secondsLeft),
      secondsLeft,
      callU: {
        title: '喊 U',
        enabled: canCallU,
        hint: canCallU ? '现在可以喊 U' : '打倒数第二张牌前再喊 U'
      }
    };
  }

  private hand(hand: Card[], playableCardIds: string[], selectedCardId: CardId | null): HandLayoutViewModel {
    return {
      cards: this.handView.build(hand, playableCardIds, selectedCardId ?? undefined),
      scrollable: hand.length >= 13,
      selectedCardId,
      playableOutsideHint: hand.length >= 13 && playableCardIds.length > 0
    };
  }

  private colorPicker(hand: Card[], cardId: CardId): ColorPickerViewModel | null {
    const card = hand.find((candidate) => candidate.id === cardId);
    if (!card || (card.type !== 'wild_color' && card.type !== 'wild_plus_four')) {
      return null;
    }
    const recommendedColor = this.recommendColor(hand);
    return {
      cardId,
      title: '选择颜色',
      colors: [
        { color: 'red', title: '红色', recommended: recommendedColor === 'red' },
        { color: 'yellow', title: '黄色', recommended: recommendedColor === 'yellow' },
        { color: 'blue', title: '蓝色', recommended: recommendedColor === 'blue' },
        { color: 'green', title: '绿色', recommended: recommendedColor === 'green' }
      ]
    };
  }

  private recommendColor(hand: Card[]): PlayableColor {
    const counts: Record<PlayableColor, number> = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const card of hand) {
      if (card.color !== 'wild') {
        counts[card.color] += 1;
      }
    }
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'blue') as PlayableColor;
  }

  private positionsFor(count: number): Array<PlayerSeatLayoutViewModel['position']> {
    if (count === 1) {
      return ['top'];
    }
    if (count === 2) {
      return ['left', 'right'];
    }
    return ['left', 'top', 'right'];
  }

  private nicknameFor(player: PlayerState, index: number): string {
    return player.isAi ? `AI ${index + 1}` : `玩家 ${player.seatIndex + 1}`;
  }

  private playerBadge(player: PlayerState): string | null {
    if (player.isAutoPlaying) {
      return '托管';
    }
    if (!player.online) {
      return '离线';
    }
    return player.handCount === 1 ? '剩 1 张' : null;
  }

  private timerLevel(secondsLeft: number): LocalPlayerPanelViewModel['timerLevel'] {
    if (secondsLeft <= 5) {
      return 'danger';
    }
    if (secondsLeft <= 10) {
      return 'warning';
    }
    return 'normal';
  }
}
