# U彩牌数据模型文档

版本：1.0  
范围：PostgreSQL 数据表、Redis Key、TTL、索引和清理策略

## 1. 存储原则

- Redis 存高频、短生命周期的房间和对局状态。
- PostgreSQL 存用户、广告奖励、对局记录、操作日志等持久数据。
- 服务端内存可以缓存热点配置，但不能作为唯一数据源。
- 对局结束后，Redis 状态清理，关键记录写入数据库。
- 数据库中保存规则配置快照，避免后续规则改动影响历史回放。

## 2. PostgreSQL 表

### 2.1 users

用户表。

```sql
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  openid_hash VARCHAR(128) NOT NULL UNIQUE,
  nickname VARCHAR(64) NOT NULL DEFAULT '玩家',
  avatar TEXT NOT NULL DEFAULT '',
  coin INTEGER NOT NULL DEFAULT 0,
  selected_card_back VARCHAR(64) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

索引：

```sql
CREATE UNIQUE INDEX idx_users_openid_hash ON users(openid_hash);
CREATE INDEX idx_users_coin_rank ON users(coin DESC, created_at ASC);
```

说明：

- 不建议明文保存 openid，使用 hash 或加密存储。
- 昵称头像可由客户端授权后更新。
- 金币排行榜按 `coin DESC, created_at ASC` 排序，同金币时更早创建账号排前。
- 排行榜只展示 `id`、`nickname`、`avatar`、`coin` 和计算出的名次。

### 2.2 rooms

房间记录表。

```sql
CREATE TABLE rooms (
  id VARCHAR(16) PRIMARY KEY,
  owner_id VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
```

索引：

```sql
CREATE INDEX idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX idx_rooms_status_created_at ON rooms(status, created_at);
```

### 2.3 game_records

对局结果表。

```sql
CREATE TABLE game_records (
  id VARCHAR(32) PRIMARY KEY,
  room_id VARCHAR(16) NOT NULL,
  rule_config JSONB NOT NULL,
  players JSONB NOT NULL,
  rankings JSONB NOT NULL,
  winner_id VARCHAR(32),
  seed_hash VARCHAR(128) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL
);
```

索引：

```sql
CREATE INDEX idx_game_records_room_id ON game_records(room_id);
CREATE INDEX idx_game_records_winner_id ON game_records(winner_id);
CREATE INDEX idx_game_records_ended_at ON game_records(ended_at);
```

### 2.4 game_actions

对局操作日志表。

```sql
CREATE TABLE game_actions (
  id BIGSERIAL PRIMARY KEY,
  game_id VARCHAR(32) NOT NULL,
  player_id VARCHAR(32),
  action_type VARCHAR(32) NOT NULL,
  action_payload JSONB NOT NULL,
  state_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

索引：

```sql
CREATE INDEX idx_game_actions_game_id ON game_actions(game_id);
CREATE INDEX idx_game_actions_created_at ON game_actions(created_at);
```

说明：

- 只保存必要操作，不长期保存完整手牌快照。
- 如需争议复盘，可通过初始牌序和操作日志重放。

### 2.5 ad_rewards

广告奖励记录。

```sql
CREATE TABLE ad_rewards (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  reward_type VARCHAR(32) NOT NULL,
  amount INTEGER NOT NULL,
  ad_unit_id VARCHAR(128),
  claimed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

索引：

```sql
CREATE INDEX idx_ad_rewards_user_date ON ad_rewards(user_id, claimed_date);
CREATE INDEX idx_ad_rewards_type_date ON ad_rewards(reward_type, claimed_date);
```

### 2.6 user_daily_stats

用户每日统计。

```sql
CREATE TABLE user_daily_stats (
  user_id VARCHAR(32) NOT NULL,
  stat_date DATE NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  ad_rewards_claimed INTEGER NOT NULL DEFAULT 0,
  coin_earned INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stat_date)
);
```

### 2.7 app_configs

远程配置表。

```sql
CREATE TABLE app_configs (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

配置示例：

```json
{
  "defaultRoomConfig": {
    "playerCount": 4,
    "initialCards": 7,
    "turnSeconds": 30,
    "ruleSet": "standard",
    "plusTwoStack": false,
    "plusFourStack": false,
    "sameColorDump": false,
    "callUPenalty": false,
    "specialPacks": []
  }
}
```

## 3. Redis Key 设计

### 3.1 房间状态

```text
room:{roomId}
```

类型：String JSON  
TTL：等待中 2 小时，对局中 4 小时  

内容：

```json
{
  "roomId": "839201",
  "ownerId": "u_1",
  "status": "waiting",
  "config": {},
  "players": [
    {
      "id": "u_1",
      "seatIndex": 0,
      "ready": true,
      "online": true,
      "isAi": false,
      "isAutoPlaying": false,
      "disconnectAt": null,
      "autoPlayAt": null
    }
  ],
  "createdAt": 1781870000000
}
```

### 3.2 对局状态

```text
game:{roomId}
```

类型：String JSON  
TTL：4 小时  

内容：

```json
{
  "roomId": "839201",
  "gameId": "g_10001",
  "status": "playing",
  "ruleConfig": {},
  "players": ["u_1", "u_2", "ai_1", "ai_2"],
  "playerRuntime": {
    "u_1": {
      "online": true,
      "isAutoPlaying": false,
      "disconnectAt": null,
      "autoPlayAt": null
    }
  },
  "deck": [],
  "discardPile": [],
  "hands": {},
  "currentPlayerId": "u_1",
  "direction": 1,
  "currentColor": "red",
  "pendingDrawCount": 0,
  "turnDeadline": 1781870030000,
  "stateVersion": 12
}
```

### 3.3 用户所在房间

```text
room:player:{userId}
```

类型：String  
TTL：等待房间 2 小时，对局中 4 小时  
值：`roomId`

用途：

- 防止用户重复进入多个房间。
- 断线后快速找到房间。
- 客户端重启后自动回到未结束房间。

### 3.4 Socket 映射

```text
socket:user:{userId}
```

类型：String  
TTL：连接期间刷新，断线后 2 分钟  
值：`socketId`

### 3.5 断线托管标记

```text
autoplay:room:{roomId}:player:{userId}
```

类型：String JSON  
TTL：对局结束或 4 小时  

内容：

```json
{
  "disconnectAt": 1781870000000,
  "autoPlayAt": 1781870015000,
  "isAutoPlaying": true
}
```

用途：

- 标记玩家是否已进入托管。
- 服务端定时器或回合流转时判断是否由 AI 行动。
- 玩家重连后删除该 key 或将 `isAutoPlaying` 置为 false。

### 3.6 房间锁

```text
lock:room:{roomId}
```

类型：String  
TTL：5 秒  

用途：

- 防止多人同时操作同一个房间状态造成竞争。
- 出牌、摸牌、开始游戏等操作必须加锁。

### 3.6 广告奖励计数

```text
ad:claim:{userId}:{date}:{rewardType}
```

类型：Integer  
TTL：2 天  

用途：

- 快速判断每日广告奖励次数。
- 最终仍写入 PostgreSQL。

## 4. 状态版本

每个 `game:{roomId}` 都维护 `stateVersion`。

规则：

- 每次有效操作后 `stateVersion + 1`。
- WebSocket 下发状态包含 `stateVersion`。
- 客户端重连时带 `lastSeq` 或最后状态版本。
- 服务端以当前完整状态为准。

## 5. TTL 与清理策略

Redis：

- 等待房间超过 2 小时未开始，自动过期。
- 对局房间超过 4 小时未结束，标记异常并清理。
- 用户 socket 映射断线后保留 2 分钟。
- 用户所在房间映射等待房间保留 2 小时，对局中保留到对局结束。
- 断线托管标记保留到玩家重连或对局结束。

PostgreSQL：

- `game_actions` 保留 30 到 90 天，按运营需要调整。
- `game_records` 长期保留。
- `ad_rewards` 至少保留 180 天。
- 日志量增长后按月份分表或归档。

## 6. 数据写入时机

创建房间：

- 写 Redis `room:{roomId}`。
- 写 PostgreSQL `rooms`。

开始游戏：

- 写 Redis `game:{roomId}`。
- 更新 PostgreSQL `rooms.status = started`。

每步操作：

- 更新 Redis `game:{roomId}`。
- 异步写 PostgreSQL `game_actions`。

对局结束：

- 写 PostgreSQL `game_records`。
- 更新 PostgreSQL `rooms.status = ended`。
- 删除 Redis `room:{roomId}`、`game:{roomId}`、`room:player:{userId}`、`autoplay:room:{roomId}:player:{userId}`。

广告奖励：

- Redis 计数加 1。
- PostgreSQL 写 `ad_rewards`。
- 更新 `users.coin`。
- 更新 `user_daily_stats`。

## 7. 并发控制

所有对局操作使用房间锁：

```text
lock:room:{roomId}
```

流程：

```text
获取锁
读取 game state
校验操作
更新状态
写回 Redis
释放锁
广播状态
异步写操作日志
```

如果获取锁失败：

- 等待 50ms 到 100ms 后重试一次。
- 仍失败则返回 `SERVER_BUSY`。

## 8. 数据隐私

- 不明文保存 openid。
- 不记录用户敏感信息。
- 对局日志不对普通用户开放。
- 客户端只收到自己手牌。
- 分享房间只带房间号，不带 token。

## 9. 首版可简化项

如果服务器配置较低，首版可以简化：

- `game_actions` 异步批量写入。
- 排行榜首版只做金币总榜，不做周榜、好友榜、分段榜。
- 暂不做完整回放，只保留 seed hash 和关键操作。
- 统计表每日定时聚合，首版也可只写基础字段。

不能简化：

- 服务端洗牌。
- 服务端出牌校验。
- 服务端摸牌。
- 其他玩家手牌不可见。
- 广告奖励服务端限次。
