# U彩牌规则引擎设计文档

版本：1.0  
目标：支持首版标准玩法，并为后续同色全出、加牌叠加、气球牌等特殊玩法预留扩展能力

## 1. 设计目标

规则引擎是服务端最核心模块。它必须保证：

- 洗牌、发牌、摸牌、出牌、胜负判断都在服务端完成。
- 客户端只提交玩家操作意图。
- 所有规则由 `RuleConfig` 控制。
- 后续新增特殊牌和特殊规则时，不重写主流程。
- 每个规则和特殊牌都能单独测试。

## 2. 核心数据类型

### 2.1 Card

```ts
type CardColor = 'red' | 'yellow' | 'blue' | 'green' | 'wild';

type CardType =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'plus_two'
  | 'wild_color'
  | 'wild_plus_four'
  | 'balloon'
  | 'swap_hand'
  | 'color_lock';

type Card = {
  id: string;
  color: CardColor;
  type: CardType;
  value?: string;
};
```

### 2.2 RuleConfig

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
  plusFourEnabled: boolean;
  plusFourChallenge: boolean;
  specialPacks: Array<'balloon' | 'swap_hand' | 'color_lock'>;
  aiFill: boolean;
  rounds: 1 | 3 | 5;
};
```

### 2.3 GameState

```ts
type GameState = {
  roomId: string;
  gameId: string;
  status: 'waiting' | 'playing' | 'finished';
  ruleConfig: RuleConfig;
  players: PlayerState[];
  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  currentPlayerId: string;
  direction: 1 | -1;
  currentColor: CardColor;
  pendingDrawCount: number;
  pendingDrawSource?: 'plus_two' | 'wild_plus_four';
  pendingChallenge?: {
    challengerId: string;
    challengedPlayerId: string;
    cardId: string;
    previousColor: CardColor;
  };
  turnDeadline: number;
  seedHash: string;
};
```

## 3. 模块拆分

### 3.1 GameEngine

对外唯一入口，负责协调各子模块。

```ts
class GameEngine {
  createGame(roomConfig: RuleConfig): GameState {}
  playCards(state: GameState, playerId: string, cardIds: string[], chooseColor?: CardColor): GameResult {}
  drawCard(state: GameState, playerId: string): GameResult {}
  passTurn(state: GameState, playerId: string): GameResult {}
  handleTimeout(state: GameState, playerId: string): GameResult {}
}
```

### 3.2 RuleValidator

负责判断操作是否合法。

- 是否轮到该玩家。
- 玩家是否拥有提交的牌。
- 单张出牌是否合法。
- 同色全出是否合法。
- 加牌叠加是否合法。
- 是否需要选择颜色。
- 是否存在待处理 +4 质疑。

### 3.3 EffectResolver

负责结算卡牌效果。

- Skip。
- Reverse。
- +2。
- 变色。
- +4。
- 特殊牌。

### 3.4 TurnResolver

负责计算下一位玩家。

- 正向 / 反向。
- 跳过玩家。
- 2 人局 Reverse 等同 Skip。
- 托管玩家自动行动。

### 3.5 DeckResolver

负责牌堆相关操作。

- 创建牌堆。
- 安全随机洗牌。
- 发起手牌。
- 摸牌。
- 牌堆耗尽时重洗弃牌堆。

### 3.6 ScoreResolver

负责结算排名和分数。

- 玩家出完牌。
- 统计剩余手牌。
- 生成排名。
- 生成对局记录。

## 4. 标准出牌流程

```text
收到 play_card
  -> 校验房间和玩家
  -> 读取 GameState
  -> RuleValidator 校验 cardIds
  -> 从玩家手牌移除卡牌
  -> 加入弃牌堆
  -> EffectResolver 结算效果
  -> ScoreResolver 检查胜负
  -> TurnResolver 切换回合
  -> 写回 Redis
  -> 广播状态和动画事件
```

## 5. 出牌合法性

标准规则下，牌满足以下任一条件即可打出：

- 颜色等于当前颜色。
- 数字等于弃牌堆顶部数字。
- 功能类型等于弃牌堆顶部功能类型。
- 牌是 `wild_color`。
- 牌是 `wild_plus_four`，且房间开启强制摸四。

如果存在待摸牌状态：

- 只有开启叠加规则时，才允许继续打对应加牌。
- 不能叠加时，玩家必须摸累计张数。

## 6. 功能牌效果

### 6.1 Skip

- 设置下一位玩家为跳过。
- 回合切换到再下一位玩家。
- 广播 `skip` 动画事件。

### 6.2 Reverse

- 3 人或 4 人局：`direction *= -1`。
- 2 人局：等同 Skip。
- 广播 `reverse` 动画事件，客户端显示中央转圈箭头。

### 6.3 Plus Two

默认规则：

- 下家摸 2 张。
- 下家跳过。

叠加规则：

- 设置或增加 `pendingDrawCount`。
- 设置 `pendingDrawSource = 'plus_two'`。
- 下家如果有 +2，可继续叠加。

### 6.4 Wild Color

- 必须传 `chooseColor`。
- 更新 `currentColor`。
- 广播变色动画事件。

### 6.5 Wild Plus Four

默认规则：

- 必须传 `chooseColor`。
- 如果 `plusFourChallenge = true`，下家可以选择质疑或摸 4 张。
- 如果 `plusFourChallenge = false`，下家摸 4 张并跳过。

质疑规则：

- 服务端记录打出 +4 前的 `previousColor`。
- 质疑者选择质疑时，服务端检查出牌者当时手牌中是否有 `previousColor` 的可出牌。
- 如果出牌者当时有 `previousColor` 可出牌，则质疑成功，出牌者摸 4 张，+4 效果取消。
- 如果出牌者当时没有 `previousColor` 可出牌，则质疑失败，质疑者摸 6 张并跳过回合。
- 质疑结果由服务端下发，客户端只播放对应动画。

叠加规则：

- 设置或增加 `pendingDrawCount`。
- 设置 `pendingDrawSource = 'wild_plus_four'`。
- 如果同时开启 +4 叠加和 +4 质疑，优先让目标玩家选择“叠加 / 质疑 / 摸牌”；选择叠加后继续累计，选择质疑后结算质疑。

## 7. 扩展规则

### 7.1 同色全出

配置：

```ts
sameColorDump: true
```

规则：

- 玩家可一次提交多张同色牌。
- 所有牌必须与当前颜色一致，或第一张牌满足当前可出规则。
- 服务端按提交顺序处理。
- 最后一张功能牌才触发主效果。
- 如果包含多张功能牌，首版建议拒绝，避免结算混乱。

### 7.2 加二加四叠加

配置：

```ts
plusTwoStack: true
plusFourStack: true
mixedDrawStack: false
```

规则：

- `pendingDrawCount` 记录累计摸牌数。
- `pendingDrawSource` 记录惩罚来源。
- `mixedDrawStack = false` 时，+2 只能叠 +2，+4 只能叠 +4。
- `mixedDrawStack = true` 时，+2 与 +4 可以互相叠加。

### 7.3 气球牌

配置：

```ts
specialPacks: ['balloon']
```

候选效果：

- 随机改变当前颜色。
- 让下家下回合开始前先摸 1 张。
- 让所有玩家看到一个随机事件动画。

要求：

- 随机结果由服务端生成。
- 客户端只播放服务端下发的结果。

### 7.4 交换手牌牌

配置：

```ts
specialPacks: ['swap_hand']
```

规则：

- 出牌者选择一个目标玩家。
- 双方交换全部手牌。
- 如果目标玩家只剩 1 张牌，需要特别提示。

### 7.5 颜色封锁牌

配置：

```ts
specialPacks: ['color_lock']
```

规则：

- 出牌者指定一种颜色。
- 下一位玩家本回合不能出该颜色。
- 只持续一个回合。

## 8. AI 对接

详细 AI 策略见 `doc/ai_strategy_design.md`。本章节只定义规则引擎与 AI 的接口边界。

AI 不能写死标准规则，必须读取 `RuleConfig`。

AI 输入：

- 当前手牌。
- 当前颜色。
- 弃牌堆顶部牌。
- 玩家手牌数量。
- `RuleConfig`。
- `pendingDrawCount`。

AI 输出：

```ts
type AiAction =
  | { type: 'play_card'; cardIds: string[]; chooseColor?: CardColor }
  | { type: 'draw_card' }
  | { type: 'pass_turn' };
```

AI 策略需要支持：

- 标准出牌。
- 被加牌时是否叠加。
- 同色全出时是否一次打多张。
- 变色时选择手牌最多的颜色。
- 对下家剩 1 张牌时优先压制。

## 9. 测试用例

必须覆盖：

- 数字牌同色可出。
- 数字牌同数字可出。
- 不同色不同数字不可出。
- Skip 跳过下家。
- Reverse 在 2 人局等同 Skip。
- Reverse 在 3/4 人局改变方向。
- +2 默认让下家摸 2 并跳过。
- +2 叠加开启后可累计。
- +4 需要选择颜色。
- +4 质疑成功时，出牌者摸 4 张。
- +4 质疑失败时，质疑者摸 6 张。
- 变色牌更新当前颜色。
- 同色全出开启时允许多张同色。
- 同色全出关闭时拒绝多张出牌。
- 气球牌随机结果由服务端生成。
- 玩家没有的牌不能打出。
- 非当前玩家不能操作。
- 出完最后一张牌立即结算。

## 10. 日志要求

每次对局记录：

- 房间号。
- 对局 ID。
- 规则配置快照。
- 随机种子 hash。
- 每一步操作。
- 服务端校验结果。
- 最终排名。

日志不能泄露给其他玩家，但需要用于争议排查和问题复现。
