# U彩牌技术实施 Plan

版本：1.0  
平台：微信小游戏  
首版范围：人机对战 + 好友房  
暂不包含：在线匹配、段位、复杂商城、观战、公会、语音聊天

## 1. 总体技术路线

客户端使用 Cocos Creator + TypeScript。  
服务端使用 Node.js + NestJS + WebSocket + Redis + PostgreSQL。  
部署使用 Docker + Nginx + HTTPS/WSS。  

整体架构：

```text
微信小游戏客户端
  - Cocos Creator
  - TypeScript
  - 微信小游戏 SDK
  - HTTPS API
  - WebSocket

服务端
  - NestJS HTTP API
  - WebSocket 对局网关
  - Redis 房间状态
  - PostgreSQL 用户与对局数据
  - 服务端洗牌、发牌、规则校验

运维
  - Docker
  - Nginx
  - HTTPS / WSS 证书
  - 日志与监控
```

核心原则：

- 客户端只负责展示和发送操作。
- 服务端负责洗牌、发牌、规则校验、胜负判断。
- 规则引擎必须配置化和可扩展，不能把标准规则写死在流程里。
- 好友房对局状态放 Redis。
- 用户、广告奖励、对局记录放 PostgreSQL。
- 广告不能影响好友房公平胜负。

## 2. 客户端 Plan

### 2.1 技术栈

- Cocos Creator
- TypeScript
- 微信小游戏构建目标
- 微信 API：登录、分享、广告、WebSocket、本地存储

### 2.2 客户端目录

```text
client/
  assets/
    scenes/
      Lobby.scene
      Room.scene
      Game.scene
      Result.scene
    scripts/
      core/
        EventBus.ts
        GameConfig.ts
        AudioManager.ts
        AssetManager.ts
      net/
        ApiClient.ts
        WsClient.ts
        Protocol.ts
      model/
        User.ts
        Room.ts
        GameState.ts
        Card.ts
      lobby/
        LobbyView.ts
        ModeSelectView.ts
      room/
        RoomView.ts
        CreateRoomView.ts
      game/
        GameController.ts
        CardView.ts
        HandCardView.ts
        PlayerSeatView.ts
        DiscardPileView.ts
    textures/
    audio/
    prefabs/
```

### 2.3 客户端模块

ApiClient：

- 微信登录。
- 获取用户信息。
- 创建房间。
- 获取远程配置。
- 领取广告奖励。

WsClient：

- 建立 WSS 连接。
- 加入房间。
- 发送出牌、摸牌、准备、开始等消息。
- 接收房间和对局状态。
- 自动重连。
- 重连后自动请求恢复未结束房间。

GameController：

- 根据服务端状态刷新 UI。
- 控制手牌、弃牌堆、当前颜色、倒计时。
- 禁止客户端自行修改游戏结果。

AudioManager：

- 播放按钮、出牌、摸牌、胜负等音效。
- 管理音乐和音效开关。

AssetManager：

- 管理主包资源。
- 管理分包资源。
- 管理远程 CDN 资源。

### 2.4 客户端状态模型

```ts
type GameState = {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: PlayerState[];
  currentPlayerId: string;
  direction: 1 | -1;
  currentColor: 'red' | 'yellow' | 'blue' | 'green';
  discardTop: Card;
  myHand: Card[];
  deckCount: number;
  turnDeadline: number;
};
```

注意：

- 其他玩家只展示手牌数量，不下发具体手牌。
- 自己的手牌由服务端下发。
- 摸牌结果由服务端返回。
- 客户端不得自己生成牌。

### 2.5 微信小游戏配置

`game.json` 建议：

```json
{
  "deviceOrientation": "portrait",
  "networkTimeout": {
    "request": 10000,
    "connectSocket": 10000,
    "uploadFile": 10000,
    "downloadFile": 10000
  },
  "subpackages": [
    {
      "name": "game",
      "root": "subpackages/game"
    },
    {
      "name": "room",
      "root": "subpackages/room"
    }
  ]
}
```

资源拆分：

- 主包：启动页、首页、登录、基础 UI、通用音效。
- game 分包：对局场景、卡牌资源、对局音效。
- room 分包：好友房创建、等待页、房间资源。
- CDN：背景音乐、大图、可选皮肤、活动资源。

## 3. 服务端 Plan

### 3.1 技术栈

- Node.js 20+
- NestJS
- WebSocket Gateway
- Redis
- PostgreSQL
- Prisma ORM
- Docker

### 3.2 服务端目录

```text
server/
  src/
    main.ts
    app.module.ts
    modules/
      auth/
        auth.controller.ts
        auth.service.ts
      user/
        user.controller.ts
        user.service.ts
      room/
        room.gateway.ts
        room.service.ts
        room.types.ts
      game/
        game.engine.ts
        game.rules.ts
        game.shuffle.ts
        game.types.ts
      reward/
        reward.controller.ts
        reward.service.ts
      config/
        config.controller.ts
        config.service.ts
    common/
      guards/
      filters/
      utils/
```

### 3.3 核心服务

AuthService：

- 接收微信 `wx.login` code。
- 调用微信接口换取 openid。
- 创建或读取用户。
- 返回业务 token。

UserService：

- 用户资料。
- 金币。
- 牌背。
- 基础统计。

LeaderboardService：

- 查询金币排行榜。
- 查询当前用户自己的金币排名。
- 只返回昵称、头像、金币、名次等公开展示字段。
- 首版按 `users.coin` 排序，不做复杂赛季榜。

RoomService：

- 创建房间。
- 加入房间。
- 离开房间。
- 准备状态。
- 房间规则。
- AI 补位。
- 断线座位保留。
- 重连回房。

GameEngine：

- 创建牌堆。
- 服务端随机洗牌。
- 发起手牌。
- 校验出牌。
- 处理摸牌。
- 处理功能牌。
- 处理断线托管行动。
- 判断胜负。
- 生成结算。

RewardService：

- 广告奖励记录。
- 每日次数限制。
- 发放金币或外观体验。
- 对局金币结算。
- 排行榜金币余额更新。

金币结算默认值：

- 人机局胜利：+50 金币。
- 人机局失败：+15 金币。
- 好友房第一名：+30 金币。
- 好友房其他玩家：+10 金币。
- 广告翻倍只翻倍本局基础金币奖励。
- 排行榜按用户当前金币余额排名。
- 首版建议每日对局金币获取上限为 1000 金币，防止刷榜。

ConfigService：

- 远程配置。
- 广告开关。
- 活动配置。
- 规则包配置。
- 特殊牌配置。
- 房间默认规则配置。

### 3.4 API 设计

微信登录：

```text
POST /api/auth/wechat-login
```

请求：

```json
{
  "code": "wx_login_code"
}
```

返回：

```json
{
  "token": "jwt_or_session_token",
  "user": {
    "id": "u_10001",
    "nickname": "玩家",
    "avatar": "",
    "coin": 0
  }
}
```

创建房间：

```text
POST /api/rooms
```

请求：

```json
{
  "playerCount": 4,
  "initialCards": 7,
  "turnSeconds": 30,
  "ruleSet": "standard",
  "plusTwoStack": false,
  "plusFourEnabled": true,
  "aiFill": true,
  "rounds": 1
}
```

返回：

```json
{
  "roomId": "839201",
  "wsUrl": "wss://game.example.com/ws"
}
```

领取广告奖励：

```text
POST /api/rewards/ad
```

请求：

```json
{
  "rewardType": "daily_coin"
}
```

返回：

```json
{
  "success": true,
  "coin": 100,
  "todayClaimed": 1
}
```

## 4. WebSocket 协议

客户端发送：

```text
join_room
leave_room
ready
start_game
play_card
draw_card
choose_color
pass_turn
reconnect
```

服务端下发：

```text
room_state
game_start
turn_changed
card_played
card_drawn
color_changed
player_skipped
direction_changed
player_offline
player_auto_play_started
player_reconnected
game_over
error
```

出牌消息：

```json
{
  "type": "play_card",
  "roomId": "839201",
  "cardId": "c_123",
  "chooseColor": "blue"
}
```

状态下发：

```json
{
  "type": "card_played",
  "state": {
    "roomId": "839201",
    "currentPlayerId": "u_2",
    "currentColor": "blue",
    "discardTop": {
      "id": "c_123",
      "color": "wild",
      "value": "change_color"
    },
    "players": [
      { "id": "u_1", "handCount": 3 },
      { "id": "u_2", "handCount": 6 }
    ],
    "deckCount": 42
  }
}
```

## 5. 游戏规则实现

GameEngine 接口：

```ts
class GameEngine {
  createGame(roomConfig: RoomConfig): GameState {}
  shuffleDeck(seed: string): Card[] {}
  dealCards(state: GameState): GameState {}
  playCard(
    state: GameState,
    playerId: string,
    cardId: string,
    chooseColor?: CardColor
  ): GameResult {}
  drawCard(state: GameState, playerId: string): GameResult {}
  nextTurn(state: GameState): GameState {}
  checkGameOver(state: GameState): boolean {}
}
```

### 5.1 规则配置模型

规则系统需要支持后续特殊玩法扩展。首版实现标准规则，但数据结构必须预留规则开关和特殊牌包。

```ts
type RuleConfig = {
  playerCount: 2 | 3 | 4;
  initialCards: 5 | 7 | 9;
  turnSeconds: 15 | 30 | 60;
  ruleSet: 'simple' | 'standard' | 'party';
  plusTwoStack: boolean;
  plusFourStack: boolean;
  mixedDrawStack: boolean;
  sameColorDump: boolean;
  callUPenalty: boolean;
  plusFourEnabled: boolean;
  plusFourChallenge: boolean;
  specialPacks: Array<'balloon' | 'swap_hand' | 'color_lock'>;
  aiFill: boolean;
  rounds: 1 | 3 | 5;
};
```

首版默认：

```ts
const DEFAULT_RULE_CONFIG: RuleConfig = {
  playerCount: 4,
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
  aiFill: true,
  rounds: 1
};
```

### 5.2 规则引擎拆分

不要把所有出牌逻辑写在一个巨大 `if/else` 中。建议拆成：

```text
RuleValidator：判断能不能出牌
EffectResolver：结算功能牌效果
TurnResolver：计算下一位玩家
DeckResolver：洗牌、发牌、摸牌
ScoreResolver：结算排名和分数
RuleConfigResolver：把房间设置转换为规则配置
```

特殊牌效果使用处理器注册：

```ts
type CardEffectHandler = {
  type: string;
  canPlay(ctx: RuleContext, card: Card): boolean;
  resolve(ctx: RuleContext, card: Card): EffectResult;
};
```

后续新增气球牌、交换手牌牌、颜色封锁牌时，只新增对应 handler，不改标准牌主流程。

### 5.3 后续规则扩展示例

同色全出：

- 配置项：`sameColorDump`。
- 允许玩家一次提交多张同色牌。
- 服务端按提交顺序校验每张牌。
- 最后一张功能牌才触发主要效果，避免一次打多张功能牌导致结算混乱。

加二 / 加四叠加：

- 配置项：`plusTwoStack`、`plusFourStack`、`mixedDrawStack`。
- 服务端维护 `pendingDrawCount` 和 `pendingDrawSource`。
- 玩家如果能继续叠加，则允许出对应加牌。
- 玩家不能叠加时，必须摸累计张数并跳过回合。

忘喊 U 罚牌：

- 配置项：`callUPenalty`。
- 首版默认开启，人机模式和好友房默认都开启。
- 玩家手牌为 2 张时，打出倒数第二张牌前必须先喊 U。
- 如果未喊 U 就出牌，服务端打开可抓窗口。
- 其他玩家点击目标头像抓忘喊，成功后目标玩家摸 2 张。
- 服务端必须校验可抓窗口，客户端只负责播放头像爆炸和罚牌动画。

气球牌：

- 配置项：`specialPacks` 包含 `balloon`。
- 效果可以是随机改变当前颜色，或让下家下回合先摸 1 张。
- 随机结果必须由服务端生成并下发。

规则扩展要求：

- 每个新规则都要有服务端单元测试。
- 每个新特殊牌都要有客户端动画状态。
- 房间创建时保存完整规则配置，结算记录中保存规则快照。
- AI 决策必须读取当前 `RuleConfig`，不能假设永远是标准规则。

服务端必须校验：

- 是否轮到该玩家。
- 玩家是否拥有该牌。
- 该牌是否符合当前颜色、数字或功能。
- 是否需要选择颜色。
- 是否需要处理 +4 质疑。
- 摸牌次数是否正确。
- 功能牌效果是否正确。
- 玩家是否已出完牌。
- 超时是否需要托管。

## 6. Redis 设计

Redis 用于高频房间和对局状态。

Key 设计：

```text
room:{roomId}
game:{roomId}
socket:user:{userId}
room:player:{userId}
autoplay:room:{roomId}:player:{userId}
```

`game:{roomId}` 示例：

```json
{
  "roomId": "839201",
  "status": "playing",
  "players": ["u_1", "u_2", "ai_1", "ai_2"],
  "deck": ["c_99", "c_12", "c_51"],
  "discardPile": ["c_5", "c_8"],
  "hands": {
    "u_1": ["c_1", "c_2"],
    "u_2": ["c_3", "c_4"]
  },
  "currentPlayerId": "u_1",
  "currentColor": "red",
  "direction": 1,
  "turnDeadline": 1781870000000
}
```

Redis 状态需要设置 TTL，避免废弃房间长期占用内存。

### 6.1 断线托管与重连设计

服务端需要明确区分三种状态：

```text
online：玩家 socket 正常连接
offline：玩家断线但还未托管
autoPlaying：玩家断线超过阈值，由 AI 代打
```

时间策略：

```text
0 秒：检测到 socket 断开，标记 offline
0-15 秒：等待客户端自动重连
15 秒：进入 autoPlaying，服务端广播托管开始
15 秒以后：轮到该玩家时由托管 AI 行动
10 分钟：仍保留对局座位，直到本局结束
```

客户端重连策略：

- WebSocket 断开后立即重连。
- 1 秒、2 秒、4 秒、8 秒退避，之后每 8 秒重试。
- 回到前台后立即重连。
- 重连成功后发送 `reconnect`。
- 如果客户端不知道房间号，调用服务端通过 `room:player:{userId}` 查找未结束房间。

服务端重连处理：

- 校验 token。
- 查询玩家是否属于未结束房间。
- 恢复 socket 映射。
- 设置 `online = true`。
- 设置 `isAutoPlaying = false`。
- 下发完整 `room_state` 和当前玩家视角 `game_state`。
- 广播 `player_reconnected`。

托管行动策略：

- 托管 AI 使用快速稳定策略。
- 有合法牌则优先出第一张合法牌。
- 无合法牌则摸牌。
- 需要选择颜色时选择自己手牌最多的颜色。
- 托管行动一旦执行，不因玩家重连而回滚。

## 7. 数据库设计

### 7.1 users

- id
- openid
- nickname
- avatar
- coin
- created_at
- updated_at

### 7.2 rooms

- id
- owner_id
- config
- status
- created_at
- ended_at

### 7.3 game_records

- id
- room_id
- players
- winner_id
- seed_hash
- started_at
- ended_at

### 7.4 game_actions

- id
- game_id
- player_id
- action_type
- action_payload
- created_at

### 7.5 ad_rewards

- id
- user_id
- reward_type
- amount
- created_at

## 8. 微信后台配置

小游戏后台需要配置合法域名。

request 合法域名：

```text
https://api.yourdomain.com
```

socket 合法域名：

```text
wss://game.yourdomain.com
```

downloadFile 合法域名：

```text
https://cdn.yourdomain.com
```

uploadFile 合法域名：

```text
首版不上传文件时可不配
```

要求：

- 必须 HTTPS / WSS。
- 不能直接使用 IP。
- 域名需要备案。
- 测试环境和正式环境最好分开。

## 9. 部署 Plan

### 9.1 服务器组件

```text
Nginx
NestJS App
Redis
PostgreSQL
```

建议用 Docker Compose 管理。

### 9.2 域名规划

```text
api.yourdomain.com   -> HTTP API
game.yourdomain.com  -> WebSocket
cdn.yourdomain.com   -> 静态资源
```

### 9.3 Nginx WebSocket 配置要点

```nginx
location /ws {
  proxy_pass http://app-server:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

### 9.4 环境区分

```text
dev：本地开发
test：微信体验版测试
prod：正式上线
```

客户端环境配置：

```ts
const CONFIG = {
  dev: {
    apiBase: 'https://dev-api.example.com',
    wsBase: 'wss://dev-game.example.com/ws'
  },
  test: {
    apiBase: 'https://test-api.example.com',
    wsBase: 'wss://test-game.example.com/ws'
  },
  prod: {
    apiBase: 'https://api.example.com',
    wsBase: 'wss://game.example.com/ws'
  }
};
```

## 10. 开发里程碑

### 10.1 M1：客户端人机原型

- Cocos 工程初始化。
- 首页大厅。
- 人机模式入口。
- 本地规则引擎。
- 本地 AI。
- 基础卡牌 UI。
- 基础音效。

验收：

- 不连接服务端也能完整打一局人机。

### 10.2 M2：服务端规则引擎

- NestJS 项目初始化。
- PostgreSQL 和 Redis 接入。
- 微信登录接口。
- 服务端洗牌。
- 服务端出牌校验。
- 服务端摸牌。
- 服务端结算。

验收：

- 通过接口测试可完整跑完一局服务端牌局。

### 10.3 M3：好友房

- 创建房间 API。
- WebSocket 连接。
- 加入房间。
- 准备 / 取消准备。
- 开始游戏。
- 对局状态同步。
- AI 补位。
- 断线重连。

验收：

- 两台手机可通过微信分享进入同一房间并完整结算。

### 10.4 M4：微信能力与广告

- `wx.login` 接入。
- 微信分享房间。
- 激励视频广告。
- 广告奖励服务端记录。
- 合法域名配置。
- 体验版测试。

验收：

- 体验版中可登录、分享、看广告领奖励。

### 10.5 M5：上线前打磨

- 包体优化。
- 分包加载。
- 资源压缩。
- 错误提示。
- 断线处理。
- 日志监控。
- 隐私协议和用户协议。

验收：

- 主流程稳定。
- 无明显卡顿。
- 好友房断线可恢复。
- 广告不影响公平对局。

## 11. 风险与默认决策

风险：

- 微信小游戏合法域名、备案、HTTPS/WSS 配置会影响真机测试。
- 好友房需要稳定 WebSocket，云函数不适合做实时对局。
- 客户端不能承担规则裁决，否则容易作弊。
- 广告如果影响好友房胜负，会破坏“不控牌”的核心卖点。

默认决策：

- 首版不上在线匹配。
- 首版服务端必须洗牌和裁决。
- 首版好友房对局内不出现影响胜负的广告。
- 首版 UI 资源可用原型资源，正式上线前再精修。
- 首版数据库使用 PostgreSQL；如果团队更熟悉 MySQL，也可等价替换。
