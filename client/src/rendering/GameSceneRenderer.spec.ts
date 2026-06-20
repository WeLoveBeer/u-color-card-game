import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisibleGameState } from '@shared/index.js';
import { GameStore } from '../state/GameStore.js';
import { GameSceneController } from '../game/GameSceneController.js';
import { GameSceneRenderer } from './GameSceneRenderer.js';

const state = (overrides: Partial<VisibleGameState> = {}): VisibleGameState => ({
  roomId: 'r1',
  gameId: 'g1',
  status: 'playing',
  players: [
    { id: 'me', seatIndex: 0, handCount: 2, online: true, isAi: false, isAutoPlaying: false },
    { id: 'p2', seatIndex: 1, handCount: 5, online: true, isAi: true, isAutoPlaying: false },
    { id: 'p3', seatIndex: 2, handCount: 3, online: true, isAi: false, isAutoPlaying: false },
    { id: 'p4', seatIndex: 3, handCount: 7, online: false, isAi: false, isAutoPlaying: true }
  ],
  currentPlayerId: 'me',
  direction: 1,
  currentColor: 'blue',
  discardTop: { id: 'top', color: 'blue', type: 'number', value: '2' },
  myHand: [
    { id: 'blue-7', color: 'blue', type: 'number', value: '7' },
    { id: 'wild', color: 'wild', type: 'wild_color' }
  ],
  deckCount: 42,
  pendingDrawCount: 0,
  pendingChallenge: null,
  turnDeadline: 1_000_030_000,
  turnSeq: 1,
  stateVersion: 1,
  ...overrides
});

describe('GameSceneRenderer', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('把对局 ViewModel 渲染成平台无关命令和可点击区域', () => {
    const store = new GameStore();
    store.setState(state());
    const model = new GameSceneController(store).build('me');

    const tree = new GameSceneRenderer().render(model, { width: 1080, height: 1920, safeTop: 44, safeBottom: 24 });

    expect(tree.width).toBe(1080);
    expect(tree.commands.find((command) => command.id === 'table-bg')).toMatchObject({ type: 'image', assetKey: 'background.table' });
    expect(tree.commands.find((command) => command.id === 'discard-top')).toMatchObject({ type: 'image', assetKey: 'card.blue.2' });
    expect(tree.commands.find((command) => command.id === 'draw-pile')).toMatchObject({ type: 'image', assetKey: 'card_back.default' });
    expect(tree.commands.find((command) => command.id === 'call-u-text')).toMatchObject({ type: 'text', text: '喊 U' });
    expect(tree.hitAreas.map((area) => area.action)).toEqual(expect.arrayContaining(['draw_card', 'select_card', 'call_u', 'rules', 'settings']));
  });

  it('打开颜色选择时暴露四色选择命令和 hit area', () => {
    const store = new GameStore();
    store.setState(state());
    const model = new GameSceneController(store).build('me', { pendingColorCardId: 'wild' });

    const tree = new GameSceneRenderer().render(model, { width: 1080, height: 1920 });

    expect(tree.commands.find((command) => command.id === 'color-picker-title')).toMatchObject({ type: 'text', text: '选择颜色' });
    expect(tree.hitAreas.filter((area) => area.action === 'choose_color').map((area) => area.payload?.color)).toEqual(['red', 'yellow', 'blue', 'green']);
  });

  it('当前 AI 座位会渲染思考倒计时', () => {
    const store = new GameStore();
    store.setState(state({ currentPlayerId: 'p2' }));
    const model = new GameSceneController(store).build('me');

    const tree = new GameSceneRenderer().render(model, { width: 1080, height: 1920 });

    expect(tree.commands.find((command) => command.id === 'seat-p2-timer')).toMatchObject({ type: 'text', text: '思考中 30s' });
  });
});
