import { describe, expect, it } from 'vitest';
import type { WsServerMessage } from '@shared/index.js';
import { GameAnimationOrchestrator } from '../game/GameAnimationOrchestrator.js';
import { GameStore } from '../state/GameStore.js';
import { RoomStore } from '../state/RoomStore.js';
import { MessageRouter } from './MessageRouter.js';

describe('MessageRouter', () => {
  it('会把离线、托管、重连事件同步到房间和对局状态', () => {
    const roomStore = new RoomStore();
    const gameStore = new GameStore();
    const animations = new GameAnimationOrchestrator();
    const router = new MessageRouter(roomStore, gameStore, animations);
    const players = [
      { id: 'p1', seatIndex: 0, handCount: 2, online: true, isAi: false, isAutoPlaying: false },
      { id: 'p2', seatIndex: 1, handCount: 3, online: true, isAi: false, isAutoPlaying: false }
    ];

    router.route({
      type: 'room_state',
      serverTime: 1,
      data: {
        roomId: 'r1',
        ownerId: 'p1',
        status: 'playing',
        config: {
          playerCount: 2,
          initialCards: 7,
          turnSeconds: 30,
          ruleSet: 'standard',
          plusTwoStack: false,
          plusFourStack: false,
          mixedDrawStack: false,
          sameColorDump: false,
          callUPenalty: true,
          plusFourEnabled: true,
          plusFourChallenge: true,
          specialPacks: [],
          aiFill: false,
          rounds: 1
        },
        players
      }
    });
    router.route({
      type: 'game_state',
      serverTime: 1,
      data: {
        roomId: 'r1',
        gameId: 'g1',
        status: 'playing',
        players,
        currentPlayerId: 'p1',
        direction: 1,
        currentColor: 'red',
        discardTop: { id: 'top', color: 'red', type: 'number', value: '1' },
        myHand: [],
        deckCount: 20,
        pendingDrawCount: 0,
        pendingChallenge: null,
        turnDeadline: 0,
        stateVersion: 1
      }
    });

    const offline: WsServerMessage = {
      type: 'player_offline',
      serverTime: 2,
      data: { roomId: 'r1', playerId: 'p2', autoPlayAt: 1000 }
    };
    router.route(offline);
    expect(roomStore.room?.players.find((player) => player.id === 'p2')?.online).toBe(false);
    expect(gameStore.state?.players.find((player) => player.id === 'p2')?.online).toBe(false);

    router.route({ type: 'player_auto_play_started', serverTime: 3, data: { roomId: 'r1', playerId: 'p2' } });
    expect(gameStore.state?.players.find((player) => player.id === 'p2')?.isAutoPlaying).toBe(true);

    router.route({ type: 'player_reconnected', serverTime: 4, data: { roomId: 'r1', playerId: 'p2' } });
    expect(roomStore.room?.players.find((player) => player.id === 'p2')?.online).toBe(true);
    expect(gameStore.state?.players.find((player) => player.id === 'p2')?.isAutoPlaying).toBe(false);
    expect(animations.size()).toBe(3);
  });
});
