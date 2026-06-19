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

### 5.3 获取远程配置

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

### 5.4 创建房间

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

### 5.5 查询房间

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

### 5.6 广告奖励

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

### 7.8 重连

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
        "isAi": false
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

### 8.6 回合切换

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

### 8.7 游戏结束

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

- 客户端断线后立即尝试重连。
- 1 秒、2 秒、4 秒、8 秒退避重试，最多重试 30 秒。
- 重连成功后发送 `reconnect`。
- 服务端返回当前完整 `room_state` 和 `game_state`。
- 玩家断线期间如果轮到该玩家，由服务端托管。
- 好友房对局结束前，断线玩家座位不立即释放。

## 10. 安全要求

- 客户端不能提交摸到的牌，只能请求摸牌。
- 客户端不能提交对局结果，只能提交操作。
- 服务端必须校验所有出牌。
- 服务端不能向其他玩家下发非公开手牌。
- 广告奖励必须服务端限次。
- 重要状态必须有日志，便于排查争议。
