import { ApiClient } from '../net/ApiClient.js';
import { WsClient, type SocketFactory } from '../net/WsClient.js';
import { ENDPOINTS, type RuntimeEnv } from '../core/GameConfig.js';
import { UserStore } from '../state/UserStore.js';
import { RoomStore } from '../state/RoomStore.js';
import { GameStore } from '../state/GameStore.js';
import { GameAnimationOrchestrator } from '../game/GameAnimationOrchestrator.js';
import { MessageRouter } from '../net/MessageRouter.js';

export type AppContext = {
  api: ApiClient;
  ws: WsClient;
  userStore: UserStore;
  roomStore: RoomStore;
  gameStore: GameStore;
  animations: GameAnimationOrchestrator;
  router: MessageRouter;
};

export class AppBootstrap {
  static create(env: RuntimeEnv, socketFactory: SocketFactory, fetcher: typeof fetch = fetch): AppContext {
    const endpoints = ENDPOINTS[env];
    const api = new ApiClient(endpoints.apiBase, fetcher);
    const ws = new WsClient(endpoints.wsBase, socketFactory);
    const userStore = new UserStore();
    const roomStore = new RoomStore();
    const gameStore = new GameStore();
    const animations = new GameAnimationOrchestrator();
    const router = new MessageRouter(roomStore, gameStore, animations);
    ws.onMessage((message) => router.route(message));
    return { api, ws, userStore, roomStore, gameStore, animations, router };
  }
}
