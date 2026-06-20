import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisibleGameState } from '@shared/index.js';
import { GameSceneController } from './GameSceneController.js';
import { GameStore } from '../state/GameStore.js';

const state = (overrides: Partial<VisibleGameState> = {}): VisibleGameState => ({
  roomId: 'r1',
  gameId: 'g1',
  status: 'playing',
  players: [
    { id: 'me', seatIndex: 0, handCount: 4, online: true, isAi: false, isAutoPlaying: false },
    { id: 'p2', seatIndex: 1, handCount: 5, online: true, isAi: true, isAutoPlaying: false },
    { id: 'p3', seatIndex: 2, handCount: 1, online: false, isAi: false, isAutoPlaying: true }
  ],
  currentPlayerId: 'me',
  direction: 1,
  currentColor: 'blue',
  discardTop: { id: 'top', color: 'blue', type: 'number', value: '2' },
  myHand: [
    { id: 'red-3', color: 'red', type: 'number', value: '3' },
    { id: 'blue-7', color: 'blue', type: 'number', value: '7' },
    { id: 'blue-reverse', color: 'blue', type: 'reverse' },
    { id: 'wild', color: 'wild', type: 'wild_color' }
  ],
  deckCount: 42,
  pendingDrawCount: 0,
  pendingChallenge: null,
  turnDeadline: 1_000_030_000,
  stateVersion: 1,
  ...overrides
});

describe('GameSceneController', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('会构建对局牌桌、座位、操作栏和可出手牌状态', () => {
    const store = new GameStore();
    store.setState(state());

    const model = new GameSceneController(store).build('me', { selectedCardId: 'blue-reverse' });

    expect(model.prompt).toBe('轮到你出牌');
    expect(model.table.deck).toEqual({ deckCount: 42, highlighted: false, arrowVisible: false, confirmRequired: true });
    expect(model.table.directionRing).toMatchObject({ direction: 1, color: 'blue', clockwise: true });
    expect(model.table.discard).toMatchObject({ id: 'top', assetKey: 'card.blue.2' });
    expect(model.seats.map((seat) => seat.position)).toEqual(['left', 'right']);
    expect(model.seats.find((seat) => seat.playerId === 'p3')?.badge).toBe('托管');
    expect(model.localPlayer).toMatchObject({
      playerId: 'me',
      handCount: 4,
      current: true,
      timerLevel: 'normal',
      secondsLeft: 30,
      callU: { enabled: false, hint: '打倒数第二张牌前再喊 U' }
    });
    expect(model.hand.selectedCardId).toBe('blue-reverse');
    expect(model.hand.cards.filter((card) => card.playable).map((card) => card.id)).toEqual(['blue-7', 'blue-reverse', 'wild']);
    expect(model.hand.cards.find((card) => card.id === 'blue-reverse')?.selected).toBe(true);
  });

  it('没有可出牌时会高亮摸牌堆', () => {
    const store = new GameStore();
    store.setState(
      state({
        discardTop: { id: 'top', color: 'green', type: 'number', value: '9' },
        currentColor: 'green',
        myHand: [{ id: 'red-3', color: 'red', type: 'number', value: '3' }]
      })
    );

    const model = new GameSceneController(store).build('me');

    expect(model.prompt).toBe('没有可出牌，点击牌堆摸牌');
    expect(model.table.deck).toMatchObject({ highlighted: true, arrowVisible: true, confirmRequired: false });
  });

  it('变色牌会打开颜色选择器并推荐手牌最多的颜色', () => {
    const store = new GameStore();
    store.setState(state());

    const model = new GameSceneController(store).build('me', { pendingColorCardId: 'wild' });

    expect(model.colorPicker).toMatchObject({ cardId: 'wild', title: '选择颜色' });
    expect(model.colorPicker?.colors.find((item) => item.recommended)).toMatchObject({ color: 'blue', title: '蓝色' });
  });

  it('手牌达到 13 张时使用横向滚动布局', () => {
    const store = new GameStore();
    store.setState(
      state({
        myHand: Array.from({ length: 13 }, (_, index) => ({
          id: `blue-${index}`,
          color: 'blue',
          type: 'number',
          value: String(index % 10)
        }))
      })
    );

    const model = new GameSceneController(store).build('me');

    expect(model.hand.scrollable).toBe(true);
    expect(model.hand.playableOutsideHint).toBe(true);
  });
});
