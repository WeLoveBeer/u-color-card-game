# U彩牌 API 与 WebSocket 协议文档

版本：1.0  
范围：微信登录、用户资料、好友房、人机对战辅助、广告奖励、实时对局同步

## 1. 协议原则

- HTTP API 用于登录、创建房间、查询配置、广告奖励等低频请求。
- WebSocket 用于好友房房间状态和对局状态同步。
- 客户端只发送玩家意图，服务端负责规则校验和最终状态。
- 所有请求都带业务 token。
- 所有服务端响应都使用统一错误码。
- 对局状态只给玩家下发自己可见的信息，不能泄露其他玩家手牌。

## 2. 环境地址

开发环境：

```text
API: https://dev-api.example.com
WS:  wss://dev-game.example.com/ws
```

测试环境：

```text
API: https://test-api.example.com
WS:  wss://test-game.example.com/ws
```

正式环境：

```text
API: https://api.example.com
WS:  wss://game.example.com/ws
```

## 3. 通用 HTTP 格式

请求头：

```text
Authorization: Bearer <token>
Content-Type: application/json
```

成功响应：

```json
{
  "success": true,
  "data": {}
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "房间不存在或已结束"
  }
}
```

## 4. 错误码

```text
UNAUTHORIZED：未登录或 token 失效
INVALID_PARAMS：参数错误
ROOM_NOT_FOUND：房间不存在
ROOM_FULL：房间已满
ROOM_ALREADY_STARTED：房间已开始
NOT_ROOM_OWNER：不是房主
NOT_IN_ROOM：玩家不在房间中
GAME_NOT_STARTED：游戏未开始
NOT_YOUR_TURN：还没轮到你
CARD_NOT_FOUND：玩家没有这张牌
ILLEGAL_CARD：这张牌当前不能出
COLOR_REQUIRED：需要选择颜色
CHALLENGE_NOT_ALLOWED：当前不能质疑
CHALLENGE_REQUIRED：需要选择质疑或摸牌
ACTION_TIMEOUT：操作超时
AD_REWARD_LIMIT：广告奖励次数已达上限
SERVER_ERROR：服务器错误
```

## 5. HTTP API

### 5.1 微信登录

```text
POST /api/auth/wechat-login
```

请求：

```json
{
  "code": "wx_login_code"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "jwt_or_session_token",
    "user": {
      "id": "u_10001",
      "openidHash": "hash_value",
      "nickname": "玩家",
      "avatar": "",
      "coin": 0
    }
  }
}
```

### 5.2 获取用户资料

```text
GET /api/users/me
```

响应：

```json
{
  "success": true,
  "data": {
    "id": "u_10001",
    "nickname": "玩家",
    "avatar": "",
    "coin": 1200,
    "selectedCardBack": "default"
  }
}
```

### 5.3 获取金币排行榜

```text
GET /api/leaderboards/coins?limit=100
```

说明：

- 按已登录用户当前金币数量从高到低排名。
- 相同金币时，账号创建时间更早的用户排前。
- 首版只返回前 100 名和当前用户自己的排名。
- AI 用户不进入排行榜。

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "rank": 1,
        "userId": "u_10001",
        "nickname": "玩家",
        "avatar": "",
        "coin": 12000
      }
    ],
    "me": {
      "rank": 128,
      "userId": "u_10088",
      "nickname": "我的昵称",
      "avatar": "",
      "coin": 860
    },
    "updatedAt": "2026-06-19T12:00:00Z"
  }
}
```

### 5.4 获取远程配置

```text
GET /api/config
```

响应：

```json
{
  "success": true,
  "data": {
    "minClientVersion": "1.0.0",
    "adEnabled": true,
    "defaultRoomConfig": {
      "playerCount": 4,
      "initialCards": 7,
      "turnSeconds": 30,
      "ruleSet": "standard",
      "plusTwoStack": false,
      "plusFourEnabled": true,
      "aiFill": true,
      "rounds": 1
    }
  }
}
```

### 5.5 创建房间

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
  "plusFourStack": false,
  "mixedDrawStack": false,
  "sameColorDump": false,
  "plusFourEnabled": true,
  "plusFourChallenge": true,
  "specialPacks": [],
  "aiFill": true,
  "rounds": 1
}
```

响应：

```json
{
  "success": true,
  "data": {
    "roomId": "839201",
    "wsUrl": "wss://game.example.com/ws"
  }
}
```

### 5.6 查询房间

```text
GET /api/rooms/{roomId}
```

响应：

```json
{
  "success": true,
  "data": {
    "roomId": "839201",
    "ownerId": "u_10001",
    "status": "waiting",
    "config": {},
    "players": [
      {
        "id": "u_10001",
        "nickname": "玩家",
        "avatar": "",
        "ready": true,
        "seatIndex": 0
      }
    ]
  }
}
```

### 5.7 广告奖励

```text
POST /api/rewards/ad
```

请求：

```json
{
  "rewardType": "daily_coin",
  "adUnitId": "ad_unit_id"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "rewardType": "daily_coin",
    "coinDelta": 100,
    "currentCoin": 1300,
    "todayClaimed": 1,
    "todayLimit": 5
  }
}
```

## 6. WebSocket 通用格式

客户端发送：

```json
{
  "seq": 1001,
  "type": "play_card",
  "data": {}
}
```

服务端响应或广播：

```json
{
  "seq": 1001,
  "type": "card_played",
  "serverTime": 1781870000000,
  "data": {}
}
```

错误消息：

```json
{
  "seq": 1001,
  "type": "error",
  "serverTime": 1781870000000,
  "error": {
    "code": "ILLEGAL_CARD",
    "message": "这张牌当前不能出"
  }
}
```

连接参数：

```text
wss://game.example.com/ws?token=<token>
```

## 7. WebSocket 客户端消息

### 7.1 加入房间

```json
{
  "seq": 1,
  "type": "join_room",
  "data": {
    "roomId": "839201"
  }
}
```

### 7.2 离开房间

```json
{
  "seq": 2,
  "type": "leave_room",
  "data": {
    "roomId": "839201"
  }
}
```

### 7.3 准备

```json
{
  "seq": 3,
  "type": "ready",
  "data": {
    "roomId": "839201",
    "ready": true
  }
}
```

### 7.4 开始游戏

```json
{
  "seq": 4,
  "type": "start_game",
  "data": {
    "roomId": "839201"
  }
}
```

### 7.5 出牌

```json
{
  "seq": 5,
  "type": "play_card",
  "data": {
    "roomId": "839201",
    "cardIds": ["c_123"],
    "chooseColor": "blue"
  }
}
```

说明：

- 标准规则下 `cardIds` 只有 1 张。
- 开启同色全出时，`cardIds` 可以包含多张。
- 变色牌和强制摸四牌必须传 `chooseColor`。

### 7.6 摸牌

```json
{
  "seq": 6,
  "type": "draw_card",
  "data": {
    "roomId": "839201"
  }
}
```

### 7.7 结束回合

```json
{
  "seq": 7,
  "type": "pass_turn",
  "data": {
    "roomId": "839201"
  }
}
```

### 7.8 强制摸四响应

当玩家被强制摸四影响且房间开启质疑时，客户端发送该消息。

选择摸牌：

```json
{
  "seq": 8,
  "type": "respond_plus_four",
  "data": {
    "roomId": "839201",
    "action": "draw"
  }
}
```

选择质疑：

```json
{
  "seq": 9,
  "type": "respond_plus_four",
  "data": {
    "roomId": "839201",
    "action": "challenge"
  }
}
```

### 7.9 重连

```json
{
  "seq": 10,
  "type": "reconnect",
  "data": {
    "roomId": "839201",
    "lastSeq": 120
  }
}
```

## 8. WebSocket 服务端消息

### 8.1 房间状态

```json
{
  "type": "room_state",
  "data": {
    "roomId": "839201",
    "ownerId": "u_10001",
    "status": "waiting",
    "config": {},
    "players": [
      {
        "id": "u_10001",
        "nickname": "玩家",
        "avatar": "",
        "ready": true,
        "seatIndex": 0,
        "online": true,
        "isAi": false
      }
    ]
  }
}
```

### 8.2 游戏开始

```json
{
  "type": "game_start",
  "data": {
    "roomId": "839201",
    "gameId": "g_10001",
    "state": {}
  }
}
```

### 8.3 对局状态

```json
{
  "type": "game_state",
  "data": {
    "roomId": "839201",
    "gameId": "g_10001",
    "status": "playing",
    "players": [
      {
        "id": "u_1",
        "seatIndex": 0,
        "handCount": 5,
        "online": true,
        "isAi": false,
        "isAutoPlaying": false,
        "disconnectAt": null,
        "autoPlayAt": null
      }
    ],
    "currentPlayerId": "u_1",
    "direction": 1,
    "currentColor": "red",
    "discardTop": {
      "id": "c_80",
      "color": "red",
      "value": "7",
      "type": "number"
    },
    "myHand": [],
    "deckCount": 42,
    "pendingDrawCount": 0,
    "pendingChallenge": null,
    "turnDeadline": 1781870000000
  }
}
```

说明：

- `myHand` 只对当前接收者包含自己的手牌。
- 其他玩家只显示 `handCount`。

### 8.4 出牌广播

```json
{
  "type": "card_played",
  "data": {
    "playerId": "u_1",
    "cardIds": ["c_123"],
    "publicCards": [
      {
        "id": "c_123",
        "color": "blue",
        "value": "skip",
        "type": "skip"
      }
    ],
    "effects": [
      {
        "type": "skip",
        "targetPlayerId": "u_2"
      }
    ],
    "state": {}
  }
}
```

### 8.5 摸牌广播

```json
{
  "type": "card_drawn",
  "data": {
    "playerId": "u_2",
    "count": 2,
    "drawReason": "plus_two",
    "state": {}
  }
}
```

### 8.6 强制摸四待响应

```json
{
  "type": "plus_four_response_required",
  "data": {
    "roomId": "839201",
    "targetPlayerId": "u_2",
    "challengedPlayerId": "u_1",
    "chooseColor": "blue",
    "options": ["draw", "challenge"],
    "turnDeadline": 1781870030000
  }
}
```

### 8.7 强制摸四质疑结果

质疑成功：

```json
{
  "type": "plus_four_challenge_result",
  "data": {
    "success": true,
    "challengerId": "u_2",
    "challengedPlayerId": "u_1",
    "drawPlayerId": "u_1",
    "drawCount": 4,
    "state": {}
  }
}
```

质疑失败：

```json
{
  "type": "plus_four_challenge_result",
  "data": {
    "success": false,
    "challengerId": "u_2",
    "challengedPlayerId": "u_1",
    "drawPlayerId": "u_2",
    "drawCount": 6,
    "state": {}
  }
}
```

### 8.8 回合切换

```json
{
  "type": "turn_changed",
  "data": {
    "currentPlayerId": "u_3",
    "turnDeadline": 1781870030000,
    "state": {}
  }
}
```

### 8.9 游戏结束

```json
{
  "type": "game_over",
  "data": {
    "gameId": "g_10001",
    "winnerId": "u_1",
    "rankings": [
      {
        "playerId": "u_1",
        "rank": 1,
        "remainCardCount": 0,
        "score": 0
      }
    ],
    "seedHash": "sha256_seed_hash",
    "rewards": []
  }
}
```

## 9. 重连策略

### 9.1 客户端自动重连

- 客户端检测到 WebSocket 断开后立即进入重连状态。
- 重连退避间隔：1 秒、2 秒、4 秒、8 秒，之后每 8 秒重试一次。
- 前台状态下最多持续重试 60 秒。
- 后台状态下暂停高频重试，回到前台后立即重连。
- 重连成功后发送 `reconnect`。
- 服务端返回当前完整 `room_state` 和 `game_state`。

### 9.2 服务端断线状态

- 服务端检测 socket 关闭后，记录 `disconnectAt`。
- 玩家 `online = false`。
- 广播 `player_offline`，通知其他玩家该玩家掉线。
- 断线超过 15 秒且对局仍未结束，设置 `isAutoPlaying = true`。
- 如果此时轮到该玩家，服务端立即执行一次托管行动。
- 如果还没轮到该玩家，则轮到该玩家时由托管 AI 行动。

座位保留：

- 好友房对局结束前，断线玩家座位不释放。
- 等待房间中断线超过 120 秒，房主可移除该玩家。
- 对局中断线超过 10 分钟仍保留座位，但持续托管到本局结束。

### 9.3 重连回房

重连请求：

```json
{
  "seq": 8,
  "type": "reconnect",
  "data": {
    "roomId": "839201",
    "lastSeq": 120
  }
}
```

服务端处理：

- 校验 token 对应用户是否属于该房间。
- 如果房间仍存在，恢复 socket 映射。
- 设置 `online = true`。
- 清空 `disconnectAt`。
- 如果玩家此前被托管，设置 `isAutoPlaying = false`。
- 下发完整 `room_state` 和当前玩家视角的 `game_state`。
- 广播 `player_reconnected`。

如果玩家没有传 `roomId`：

- 服务端通过 `room:player:{userId}` 查找未结束房间。
- 找到则返回该房间状态。
- 找不到则返回 `ROOM_NOT_FOUND`。

### 9.4 托管期间玩家回归

- 如果托管 AI 正在等待行动，玩家重连后立即恢复手动操作。
- 如果托管 AI 已经完成本回合行动，该行动有效，不回滚。
- 玩家重连后从最新状态继续游戏。
- 客户端需要提示“已恢复对局，托管已关闭”。

### 9.5 相关服务端消息

玩家离线：

```json
{
  "type": "player_offline",
  "data": {
    "roomId": "839201",
    "playerId": "u_2",
    "autoPlayAt": 1781870015000
  }
}
```

玩家进入托管：

```json
{
  "type": "player_auto_play_started",
  "data": {
    "roomId": "839201",
    "playerId": "u_2"
  }
}
```

玩家重连：

```json
{
  "type": "player_reconnected",
  "data": {
    "roomId": "839201",
    "playerId": "u_2"
  }
}
```

## 10. 安全要求

- 客户端不能提交摸到的牌，只能请求摸牌。
- 客户端不能提交对局结果，只能提交操作。
- 服务端必须校验所有出牌。
- 服务端不能向其他玩家下发非公开手牌。
- 广告奖励必须服务端限次。
- 重要状态必须有日志，便于排查争议。
