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

- 对局金币不再使用固定名次表，统一按本局结束时失败者的剩余手牌分结算。
- 单张牌金币分：数字牌按牌面数字计分；Skip、Reverse、+2 为 20 分；Wild、Wild +4 为 50 分。
- 2 人局：失败者按自己的剩余手牌分扣金币，胜者获得失败者实际扣除的金币。
- 3/4 人局：每个失败者分别按自己的剩余手牌分扣金币，胜者获得所有失败者实际扣除金币的总和。
- 人机局中 AI 不拥有金币，AI 应得或应扣的部分由系统发放或扣除。
- 金币不足时最低扣到 0；赢家只获得失败者实际扣掉的金币，不由系统补差，严格保持玩家之间真实零和。
- 广告翻倍只翻倍正向金币奖励，不放大失败扣除，翻倍得到的额外金币计入每日对局正向金币上限。
- 排行榜按用户当前金币余额排名。
- 任务奖励进入金币余额并参与排行榜排名。
- 首版建议每日对局正向金币获取上限为 1000 金币，防止刷榜。

ConfigService：

- 远程配置。
- 广告开关。
- 活动配置。
- 规则包配置。
- 特殊牌配置。
- 房间默认规则配置。

### 3.4 API 与 WebSocket

接口字段、消息格式、错误码、重连消息和强制摸四/喊 U/抓忘喊事件统一维护在 `doc/api_protocol.md`。

技术 Plan 只约束落地顺序：

- HTTP API 先完成登录、配置、创建房间、查询房间、广告奖励。
- WebSocket 先完成加入房间、准备、开始、出牌、摸牌、回合切换、结算。
- 断线重连、托管、强制摸四响应、喊 U 和抓忘喊跟随 M3 好友房一起接入。
- 客户端协议类型从 `api_protocol.md` 生成或手动同步到 `client/assets/scripts/net/Protocol.ts`，不要在业务脚本里散写字符串。

## 4. 规则引擎落地

规则数据类型、`RuleConfig`、`GameState`、模块接口、扩展规则和测试用例统一维护在 `doc/rule_engine_design.md`。技术 Plan 不再复制字段定义。

落地要求：

- 服务端实现按 `GameEngine`、`RuleValidator`、`EffectResolver`、`TurnResolver`、`DeckResolver`、`ScoreResolver` 拆分。
- 特殊牌使用 handler 注册，不把所有效果写进一个巨大条件分支。
- 房间创建时保存完整规则配置，对局记录保存规则快照。
- AI 决策必须读取当前 `RuleConfig`，不能假设永远是标准规则。
- 每个新规则和新特殊牌必须补服务端单元测试。

## 5. 数据与重连落地

PostgreSQL 表、Redis Key、TTL、索引和清理策略统一维护在 `doc/data_model.md`，本 Plan 不再复制字段清单。

落地要求：

- Redis 只保存高频、短生命周期状态，房间和对局状态必须设置 TTL。
- PostgreSQL 保存用户、房间记录、对局结果、操作日志、广告奖励和配置。
- 对局中断线 15 秒后进入托管，重连后从服务端最新状态恢复，不回滚托管已完成行动。
- 所有对局操作使用房间锁，避免并发出牌、摸牌和结算覆盖状态。
- 结算记录保存规则快照和随机种子 hash，便于争议排查。

## 6. 微信后台配置

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

## 7. 部署 Plan

### 7.1 服务器组件

```text
Nginx
NestJS App
Redis
PostgreSQL
```

建议用 Docker Compose 管理。

### 7.2 域名规划

```text
api.yourdomain.com   -> HTTP API
game.yourdomain.com  -> WebSocket
cdn.yourdomain.com   -> 静态资源
```

### 7.3 Nginx WebSocket 配置要点

```nginx
location /ws {
  proxy_pass http://app-server:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

### 7.4 环境区分

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

## 8. 开发里程碑

### 8.1 M1：客户端人机原型

- Cocos 工程初始化。
- 首页大厅。
- 人机模式入口。
- 本地规则引擎。
- 本地 AI。
- 基础卡牌 UI。
- 基础音效。

验收：

- 不连接服务端也能完整打一局人机。

### 8.2 M2：服务端规则引擎

- NestJS 项目初始化。
- PostgreSQL 和 Redis 接入。
- 微信登录接口。
- 服务端洗牌。
- 服务端出牌校验。
- 服务端摸牌。
- 服务端结算。

验收：

- 通过接口测试可完整跑完一局服务端牌局。

### 8.3 M3：好友房

- 创建房间 API。
- WebSocket 连接。
- 加入房间。
- 准备 / 取消准备。
- 开始游戏。
- 对局状态同步。
- AI 补位：房主点击开始时自动补满空位。
- 断线重连。

验收：

- 两台手机可通过微信分享进入同一房间并完整结算。

### 8.4 M4：微信能力与广告

- `wx.login` 接入。
- 微信分享房间。
- 激励视频广告。
- 广告奖励服务端记录。
- 合法域名配置。
- 体验版测试。

验收：

- 体验版中可登录、分享、看广告领奖励。

### 8.5 M5：上线前打磨

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

## 9. 风险与默认决策

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
