# U彩牌 Asset 需求与授权边界

版本：1.0  
用途：开发资源清单、正式替换优先级、外部素材授权登记

## 1. 当前已有原型资源

位置：`client/u_color_card_assets/`

- 卡牌：四色数字牌 0 到 9、四色禁行/转向/加二、变色牌、强制摸四牌、默认牌背。
- 背景：大厅背景、牌桌背景。
- 图标：bot、coin、rank、room、settings、share、sound、task。
- 音频：按钮、出牌、摸牌、倒计时、胜负、奖励、功能牌和 BGM 占位音频。
- 主题：`ui/theme.json`。

这些资源只作为原型占位和内部测试素材。正式上线前必须重新做美术/音频 QA，并登记来源、作者、许可、修改记录和商用范围。

## 2. 必补资源

### 2.1 人声功能牌音效

以下音效必须是人声，可以叠加轻量 whoosh、pop 或鼓点，但不能只用纯电子音替代：

```text
audio/voice_plus_two.wav       "加二"
audio/voice_skip.wav           "跳过"
audio/voice_reverse.wav        "反转"
audio/voice_color_red.wav      "红色"
audio/voice_color_yellow.wav   "黄色"
audio/voice_color_blue.wav     "蓝色"
audio/voice_color_green.wav    "绿色"
```

建议规格：

- 单声道或立体声 WAV，44.1kHz 或 48kHz，16-bit。
- 单条时长 0.3 到 0.9 秒，移动端播放不拖节奏。
- 同一位配音、同一录音环境、统一响度。
- 文件可再导出压缩版用于微信小游戏包体优化，但源文件保留 WAV。

现有 `sfx_plus_two.wav`、`sfx_skip.wav`、`sfx_reverse.wav`、`sfx_color_change.wav` 可作为临时占位或底层反馈音。正式版本应由上面的人声文件覆盖或叠加。

### 2.2 卡面原创化

卡牌下面不要跟 UNO 官方视觉做得太像。正式卡面需要避免：

- 斜向大椭圆作为主要构图。
- UNO 官方符号、字体比例、四色轮盘式万能牌布局。
- 黑底万能牌与官方产品高度相似的色块排布。
- “UNO / 乌诺 / 优诺”名称、标识或相近发音包装。

推荐方向：

- 用 U 彩自己的几何语言：U 形纹样、分层边框、角标数字、局部发光边。
- 功能牌符号可保留可读性，但用原创图形比例和线条风格。
- 万能牌可用四瓣光标、菱形色窗、环形色门等原创构图。

### 2.3 牌背

牌背使用示例图方向：

- 蓝色系底。
- 中心 U 彩识别符号。
- 几何纹样和白色外边框。
- 不使用 UNO 标志、官方斜椭圆或相近装饰。

当前 `cards/card_back_default.svg` 可继续作为牌背方向稿。

### 2.4 头像与 UI 大图

当前 mockup 中头像与场景图只作为视觉参考。正式开发需要：

- 玩家默认头像 1 套。
- AI 头像至少 3 个，适配 2/3/4 人局。
- 首页、牌桌、结算页背景图各 1 套。
- 金币、排行榜、任务、设置等 UI 图标保持统一线宽和圆角。

## 3. 推荐素材来源

优先级：

1. 自录或委托录制人声，授权最清楚。
2. 使用可商用素材平台，但每条素材单独登记许可。
3. 原型阶段可用生成/占位素材，但正式上线前必须复核。

可浏览平台：

- Freesound：https://freesound.org/ ，适合查找 Creative Commons 音频，注意不同素材可能是 CC0、CC BY 或 CC BY-NC。
- OpenGameArt：https://opengameart.org/ ，可找游戏音效、美术和 UI 资源，FAQ 说明资源可用于商业项目但必须遵守具体许可。
- Pixabay：https://pixabay.com/ ，有音效和音乐，使用前按当前 Content License 复核限制。

避免来源：

- UNO 官方素材、截图、牌面临摹、商品图切片。
- 不明来源的短视频/社媒音效。
- 只写“免版权”但没有明确许可页面的资源站。

## 4. 授权登记表字段

正式资源进入项目时，在 `client/u_color_card_assets/licenses/` 新增登记表，至少记录：

```text
file
asset_type
source_url
author
license
downloaded_at
modified_by
modification_note
commercial_ok
attribution_required
credit_text
```

没有明确商用授权的素材不能进入正式包。
