const COLORS = {
  navy: '#061b36',
  navy2: '#0b3767',
  white: '#f8fbff',
  muted: '#b6c8e7',
  green: '#44c84e',
  greenDark: '#139329',
  blue: '#1993ff',
  blueDark: '#0965d8',
  teal: '#18c6bd',
  tealDark: '#079c92',
  gold: '#ffc233',
  orange: '#ef9c1b',
  red: '#f04f42',
  purple: '#8d6dff'
};

const CARD_COLORS = {
  red: COLORS.red,
  yellow: COLORS.gold,
  blue: COLORS.blue,
  green: COLORS.green,
  wild: '#20232a'
};

export class WechatCanvasRuntime {
  constructor(options) {
    this.options = options;
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.dpr = wx.getSystemInfoSync().pixelRatio || 1;
    this.hitAreas = [];
    this.scene = 'lobby';
    this.assets = new Map();
    this.user = { nickname: '小牌手', coin: 12345 };
    this.tick = 0;
    this.toastText = '';
    this.toastUntil = 0;
    this.selectedCardId = null;
    this.drag = null;
    this.dropZone = null;
    this.handRects = [];
    this.game = null;
  }

  async start() {
    this.resize();
    await this.loadAssets();
    this.bindTouch();
    this.login();
    this.loop();
  }

  resize() {
    const info = wx.getSystemInfoSync();
    this.width = info.windowWidth;
    this.height = info.windowHeight;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  async loadAssets() {
    const assets = {
      avatar: `${this.options.assetsBase}/avatars/player_default.svg`,
      ai: `${this.options.assetsBase}/avatars/ai_wave.svg`
    };
    await Promise.all(
      Object.entries(assets).map(([key, src]) =>
        this.loadImage(src).then((image) => {
          this.assets.set(key, image);
        })
      )
    );
  }

  loadImage(src) {
    return new Promise((resolve) => {
      const image = wx.createImage();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  login() {
    wx.login({
      success: async ({ code }) => {
        try {
          const response = await this.request('/auth/wechat-login', { code });
          if (response.success) {
            this.user = response.data.user;
          }
        } catch {
          this.toast('离线模式：本地人机可玩');
        }
      }
    });
  }

  request(path, body) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.options.apiBase}${path}`,
        method: 'POST',
        data: body,
        header: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        success: (response) => {
          if (response.data?.data?.token) {
            this.token = response.data.data.token;
          }
          resolve(response.data);
        },
        fail: reject
      });
    });
  }

  bindTouch() {
    wx.onTouchStart((event) => {
      const touch = event.touches[0];
      this.onPointerDown(touch.clientX, touch.clientY);
    });
    wx.onTouchMove((event) => {
      const touch = event.touches[0];
      this.onPointerMove(touch.clientX, touch.clientY);
    });
    wx.onTouchEnd((event) => {
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      this.onPointerUp(touch?.clientX ?? 0, touch?.clientY ?? 0);
    });
  }

  onPointerDown(x, y) {
    if (this.scene === 'game') {
      const cardHit = [...this.handRects].reverse().find((rect) => this.contains(rect, x, y));
      if (cardHit) {
        this.drag = {
          cardId: cardHit.card.id,
          startX: x,
          startY: y,
          x,
          y,
          active: false
        };
        return;
      }
    }
    const hit = [...this.hitAreas].reverse().find((area) => this.contains(area, x, y));
    if (hit) {
      hit.onTap();
    } else if (this.scene === 'game') {
      this.selectedCardId = null;
    }
  }

  onPointerMove(x, y) {
    if (!this.drag) {
      return;
    }
    this.drag.x = x;
    this.drag.y = y;
    if (Math.abs(y - this.drag.startY) > 18 || Math.abs(x - this.drag.startX) > 24) {
      this.drag.active = true;
    }
  }

  onPointerUp(x, y) {
    if (!this.drag) {
      return;
    }
    const cardId = this.drag.cardId;
    const wasDrag = this.drag.active;
    const inDrop = this.dropZone && this.contains(this.dropZone, x, y);
    this.drag = null;
    if (wasDrag && inDrop) {
      this.tryPlayCard(cardId, true);
      return;
    }
    if (!wasDrag) {
      this.tapCard(cardId);
    }
  }

  contains(area, x, y) {
    return x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
  }

  loop() {
    this.tick += 1;
    this.hitAreas = [];
    this.handRects = [];
    this.dropZone = null;
    if (this.scene === 'game') {
      this.drawGame();
    } else if (this.scene === 'tasks') {
      this.drawTasks();
    } else if (this.scene === 'cardBacks') {
      this.drawCardBacks();
    } else if (this.scene === 'profile') {
      this.drawProfile();
    } else if (this.scene === 'rules') {
      this.drawRules();
    } else if (this.scene === 'settings') {
      this.drawSettings();
    } else if (this.scene === 'leaderboard') {
      this.drawLeaderboard();
    } else {
      this.drawLobby();
    }
    this.drawToast();
    requestAnimationFrame(() => this.loop());
  }

  startLocalGame() {
    const deck = this.createDeck();
    this.shuffle(deck);
    const players = [
      { id: 'me', name: '我', coin: 56, hand: [] },
      { id: 'ai_1', name: '小明', coin: 35, hand: [] },
      { id: 'ai_2', name: '思思', coin: 42, hand: [] },
      { id: 'ai_3', name: '阿强', coin: 28, hand: [] }
    ];
    for (let i = 0; i < 7; i += 1) {
      for (const player of players) {
        player.hand.push(deck.pop());
      }
    }
    let discard = deck.pop();
    while (discard.type !== 'number') {
      deck.unshift(discard);
      discard = deck.pop();
    }
    this.game = {
      roomId: 'local',
      deck,
      players,
      discard,
      currentColor: discard.color,
      currentIndex: 0,
      direction: 1,
      message: '轮到你出牌',
      calledU: false,
      finished: false,
      drawChoice: null
    };
    this.selectedCardId = null;
    this.scene = 'game';
  }

  createDeck() {
    const deck = [];
    let seq = 1;
    for (const color of ['red', 'yellow', 'blue', 'green']) {
      for (let value = 0; value <= 9; value += 1) {
        deck.push({ id: `c_${seq++}`, color, type: 'number', label: String(value) });
      }
      for (const type of ['skip', 'reverse', 'plus2']) {
        deck.push({ id: `c_${seq++}`, color, type, label: type === 'skip' ? '禁' : type === 'reverse' ? '↻' : '+2' });
      }
    }
    for (let i = 0; i < 4; i += 1) {
      deck.push({ id: `c_${seq++}`, color: 'wild', type: 'wild', label: '◎' });
      deck.push({ id: `c_${seq++}`, color: 'wild', type: 'plus4', label: '+4' });
    }
    return deck;
  }

  shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  tapCard(cardId) {
    if (!this.game || this.game.finished) {
      return;
    }
    if (this.currentPlayer().id !== 'me') {
      this.toast('等待对手出牌');
      return;
    }
    const card = this.me().hand.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    if (!this.isPlayable(card)) {
      this.toast('这张牌现在不能出');
      this.shakeCardId = cardId;
      this.shakeUntil = Date.now() + 180;
      return;
    }
    if (this.selectedCardId === cardId) {
      this.tryPlayCard(cardId, false);
    } else {
      this.selectedCardId = cardId;
      this.game.message = '再次点击确认出牌，或拖到弃牌区';
    }
  }

  tryPlayCard(cardId, fromDrag) {
    const card = this.me().hand.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    if (!this.isPlayable(card)) {
      this.toast(fromDrag ? '拖到弃牌区也不能出这张' : '这张牌现在不能出');
      return;
    }
    if (this.me().hand.length === 2 && !this.game.calledU) {
      this.game.message = '忘喊 U！本地模式罚摸 2 张';
      this.drawTo(this.me(), 2);
    }
    this.playCard(this.me(), card);
    this.selectedCardId = null;
    this.game.calledU = false;
    this.afterHumanAction();
  }

  playCard(player, card) {
    player.hand = player.hand.filter((item) => item.id !== card.id);
    this.game.discard = card;
    if (card.color !== 'wild') {
      this.game.currentColor = card.color;
    }
    if (card.type === 'wild' || card.type === 'plus4') {
      this.game.currentColor = this.recommendColor(player.hand);
    }
    if (card.type === 'reverse') {
      this.game.direction *= -1;
      this.game.message = '方向反转';
    } else if (card.type === 'skip') {
      this.game.message = '跳过一回合';
      this.advanceTurn();
    } else if (card.type === 'plus2') {
      this.advanceTurn();
      this.drawTo(this.currentPlayer(), 2);
      this.game.message = `${this.currentPlayer().name} 摸 2 张`;
    } else if (card.type === 'plus4') {
      this.advanceTurn();
      this.drawTo(this.currentPlayer(), 4);
      this.game.message = `${this.currentPlayer().name} 摸 4 张`;
    } else {
      this.game.message = `${player.name} 打出 ${this.cardName(card)}`;
    }
    if (player.hand.length === 0) {
      this.game.finished = true;
      this.user.coin += player.id === 'me' ? 120 : -30;
      this.game.message = player.id === 'me' ? '你赢了！金币 +120' : `${player.name} 获胜`;
    }
  }

  afterHumanAction() {
    if (this.game.finished) {
      return;
    }
    this.advanceTurn();
    this.runAiTurns();
  }

  runAiTurns() {
    let guard = 0;
    while (!this.game.finished && this.currentPlayer().id !== 'me' && guard < 8) {
      guard += 1;
      const ai = this.currentPlayer();
      const playable = ai.hand.find((card) => this.isPlayable(card));
      if (playable) {
        this.playCard(ai, playable);
      } else {
        this.drawTo(ai, 1);
        this.game.message = `${ai.name} 摸牌`;
      }
      if (!this.game.finished) {
        this.advanceTurn();
      }
    }
    if (!this.game.finished && this.currentPlayer().id === 'me') {
      this.game.message = this.playableCards().length > 0 ? '轮到你出牌' : '无可出牌，点击牌堆摸牌';
    }
  }

  drawTo(player, count) {
    for (let i = 0; i < count; i += 1) {
      if (this.game.deck.length === 0) {
        this.game.deck = this.createDeck();
        this.shuffle(this.game.deck);
      }
      player.hand.push(this.game.deck.pop());
    }
  }

  drawCard() {
    if (!this.game || this.game.finished) {
      return;
    }
    if (this.currentPlayer().id !== 'me') {
      this.toast('还没轮到你');
      return;
    }
    const playable = this.playableCards();
    if (playable.length > 0 && !this.confirmDraw) {
      this.confirmDraw = true;
      this.toast('有可出牌，再点牌堆确认摸牌');
      return;
    }
    this.confirmDraw = false;
    this.drawTo(this.me(), 1);
    this.game.message = '你摸了 1 张，回合结束';
    this.afterHumanAction();
  }

  callU() {
    if (!this.game || this.game.finished) {
      return;
    }
    if (this.currentPlayer().id === 'me' && this.me().hand.length === 2) {
      this.game.calledU = true;
      this.game.message = 'U！已喊';
      this.toast('U！');
    } else {
      this.toast('打倒数第二张牌前再喊 U');
    }
  }

  advanceTurn() {
    const length = this.game.players.length;
    this.game.currentIndex = (this.game.currentIndex + this.game.direction + length) % length;
  }

  currentPlayer() {
    return this.game.players[this.game.currentIndex];
  }

  me() {
    return this.game.players[0];
  }

  playableCards() {
    return this.me().hand.filter((card) => this.isPlayable(card));
  }

  isPlayable(card) {
    const top = this.game.discard;
    return card.color === 'wild' || card.color === this.game.currentColor || card.label === top.label || card.type === top.type;
  }

  recommendColor(hand) {
    const counts = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const card of hand) {
      if (counts[card.color] !== undefined) {
        counts[card.color] += 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  drawLobby() {
    const w = this.width;
    const h = this.height;
    this.drawDeepBackground();
    this.drawPlayerHeader(18, 18, w - 36, 72);
    this.drawLogo(w / 2, 154);
    const top = Math.max(238, h * 0.31);
    this.actionCard(24, top, w - 48, 88, COLORS.green, COLORS.greenDark, '快速人机', '离线也能练习出牌', 'bot', () => this.startLocalGame());
    this.actionCard(24, top + 108, w - 48, 82, COLORS.blue, COLORS.blueDark, '创建房间', '邀请好友，欢乐开局', 'house', () => this.toast('好友房需连接服务端'));
    this.actionCard(24, top + 208, w - 48, 82, COLORS.teal, COLORS.tealDark, '加入房间', '输入房号，加入对局', 'people', () => this.toast('好友房需连接服务端'));
    const smallY = top + 308;
    this.smallInfoCard(24, smallY, (w - 58) / 2, 74, '#fff3c9', '#7c4a10', '金币排行榜', '高手云集，等你上榜', 'trophy', () => {
      this.scene = 'leaderboard';
    });
    this.smallInfoCard(34 + (w - 58) / 2, smallY, (w - 58) / 2, 74, '#dceeff', '#153d78', '每日奖励', '登录领取金币', 'coin', () => {
      this.user.coin += 100;
      this.toast('金币 +100');
    });
    this.bottomNav('lobby');
  }

  drawTasks() {
    this.drawPageShell('任务');
    this.taskCard(24, 118, '完成一局人机', this.game?.finished ? 1 : 0, 1, 50);
    this.taskCard(24, 210, '赢一局', this.game?.finished && this.game.message.includes('你赢') ? 1 : 0, 1, 100);
    this.bottomNav('tasks');
  }

  drawCardBacks() {
    this.drawPageShell('牌背');
    this.text('当前使用', 24, 114, 17, COLORS.muted, '700');
    this.cardBack(this.width / 2 - 44, 138, 88, 124, 0);
    this.text('默认蓝钻牌背', this.width / 2, 292, 22, COLORS.white, '900', 'center');
    this.roundRect(36, 326, this.width - 72, 54, 12, 'rgba(68,200,78,0.9)', '#9dffb2', 2);
    this.text('已装备', this.width / 2, 361, 22, COLORS.white, '900', 'center');
    this.bottomNav('cardBacks');
  }

  drawProfile() {
    this.drawPageShell('我的');
    this.avatar(this.width / 2 - 42, 108, 84, 'avatar');
    this.text(this.user.nickname || '小牌手', this.width / 2, 222, 26, COLORS.white, '900', 'center');
    this.coinPill(this.width / 2 - 92, 244, 184, 48, this.user.coin ?? 0);
    this.profileRow(28, 328, '本地模式', '无需服务端可练习人机');
    this.profileRow(28, 394, '公平提示', '正式对局由服务端洗牌校验');
    this.bottomNav('profile');
  }

  drawRules() {
    this.drawPageShell('规则');
    const rows = [
      ['基础出牌', '颜色相同、数字相同或功能相同即可出牌。'],
      ['摸牌', '没有可出牌时点击牌堆摸一张。'],
      ['功能牌', '禁行、反转、+2、变色、+4 都有特殊效果。'],
      ['喊 U', '剩 2 张时，打出前先喊 U。']
    ];
    rows.forEach((row, index) => this.infoRow(24, 112 + index * 82, row[0], row[1]));
  }

  drawSettings() {
    this.drawPageShell('设置');
    this.infoRow(24, 118, '音乐', '开');
    this.infoRow(24, 200, '音效', '开');
    this.infoRow(24, 282, '震动', '开');
    this.infoRow(24, 364, '低电量模式', '关');
  }

  drawLeaderboard() {
    this.drawPageShell('金币排行榜');
    const items = [
      ['牌神小七', 12860],
      ['幸运星', 9520],
      ['摸牌高手', 7350],
      ['我的昵称', this.user.coin ?? 860],
      ['不出就赢', 850]
    ];
    items.forEach(([name, coin], index) => {
      const y = 120 + index * 68;
      this.roundRect(26, y, this.width - 52, 54, 12, index === 3 ? 'rgba(88,134,255,0.55)' : 'rgba(18,64,123,0.72)', '#365f9b', 1);
      this.text(String(index === 3 ? 128 : index + 1), 54, y + 35, 20, COLORS.white, '900');
      this.text(name, 96, y + 35, 19, COLORS.white, '800');
      this.coin(this.width - 98, y + 27, 12);
      this.text(this.formatCoin(coin), this.width - 78, y + 35, 18, COLORS.white, '900');
    });
  }

  drawGame() {
    if (!this.game) {
      this.startLocalGame();
      return;
    }
    const w = this.width;
    const h = this.height;
    this.drawTableBackground();
    this.iconButton(18, 18, 44, 'book', () => {
      this.scene = 'rules';
    });
    this.iconButton(72, 18, 44, 'gear', () => {
      this.scene = 'settings';
    });
    this.playerBadge(w / 2 - 78, 34, 156, 64, this.game.players[1].name, 35, this.game.players[1].hand.length, 'top');
    this.sidePlayer(6, h * 0.25, this.game.players[2].name, 42, this.game.players[2].hand.length, 'left');
    this.sidePlayer(w - 74, h * 0.25, this.game.players[3].name, 28, this.game.players[3].hand.length, 'right');
    this.colorPill(w / 2 - 74, h * 0.24, 148, 34, `当前颜色：${this.colorName(this.game.currentColor)}`);
    this.directionRing(w / 2, h * 0.43, Math.min(w * 0.25, 110), CARD_COLORS[this.game.currentColor]);
    const deckRect = { x: w * 0.25 - 42, y: h * 0.43 - 46, w: 82, h: 112 };
    this.drawDeck(deckRect.x, deckRect.y, this.currentPlayer().id === 'me' && this.playableCards().length === 0);
    this.hitAreas.push({ ...deckRect, onTap: () => this.drawCard() });
    const discardRect = { x: w * 0.58 - 34, y: h * 0.43 - 54, w: 84, h: 118 };
    this.dropZone = { x: discardRect.x - 28, y: discardRect.y - 28, w: discardRect.w + 56, h: discardRect.h + 56 };
    if (this.drag?.active && this.dropZone) {
      this.roundRect(this.dropZone.x, this.dropZone.y, this.dropZone.w, this.dropZone.h, 18, 'rgba(93,234,255,0.16)', '#5deaff', 3);
    }
    this.drawDiscard(discardRect.x, discardRect.y);
    this.speechBubble(w / 2 - 95, h * 0.575, 190, 42, this.game.message);
    this.playerBadge(24, h * 0.64, 170, 62, '我', 56, this.me().hand.length, 'bottom');
    this.redButton(w - 132, h * 0.65, 94, 50, '喊 U', () => this.callU());
    this.turnHint(w / 2, h * 0.75);
    this.handCards(h - 122);
    if (this.game.finished) {
      this.roundRect(32, h * 0.34, w - 64, 150, 18, 'rgba(5,23,50,0.9)', '#7bb7ff', 2);
      this.text(this.game.message, w / 2, h * 0.34 + 60, 26, COLORS.white, '900', 'center');
      this.roundRect(w / 2 - 84, h * 0.34 + 88, 168, 44, 12, COLORS.green, '#a3ffb4', 2);
      this.text('再来一局', w / 2, h * 0.34 + 117, 21, COLORS.white, '900', 'center');
      this.hitAreas.push({ x: w / 2 - 84, y: h * 0.34 + 88, w: 168, h: 44, onTap: () => this.startLocalGame() });
    }
  }

  drawPageShell(title) {
    this.drawDeepBackground();
    this.iconButton(20, 24, 46, 'back', () => {
      this.scene = 'lobby';
    });
    this.text(title, this.width / 2, 60, 32, COLORS.white, '900', 'center');
  }

  taskCard(x, y, title, progress, total, reward) {
    this.roundRect(x, y, this.width - 48, 70, 14, 'rgba(226,241,255,0.95)', '#ffffff', 2);
    this.text(title, x + 18, y + 28, 19, '#12325c', '900');
    this.text(`${progress}/${total}`, x + 18, y + 54, 15, '#46627f', '800');
    this.coin(x + this.width - 96, y + 35, 14);
    this.text(`+${reward}`, x + this.width - 76, y + 42, 18, '#12325c', '900');
  }

  profileRow(x, y, title, subtitle) {
    this.roundRect(x, y, this.width - 56, 54, 12, 'rgba(18,64,123,0.8)', '#4c83c3', 1.5);
    this.text(title, x + 18, y + 23, 18, COLORS.white, '900');
    this.text(subtitle, x + 18, y + 44, 13, COLORS.muted, '700');
  }

  infoRow(x, y, title, body) {
    this.roundRect(x, y, this.width - 48, 64, 12, 'rgba(18,64,123,0.84)', '#4c83c3', 1.5);
    this.text(title, x + 16, y + 25, 19, COLORS.white, '900');
    this.text(body, x + 16, y + 48, 14, COLORS.muted, '700');
  }

  drawDeepBackground() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, '#071a33');
    g.addColorStop(0.45, '#0b315c');
    g.addColorStop(1, '#06172e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 24; i += 1) {
      this.circle((i % 6) * 20 + 16, Math.floor(i / 6) * 20 + 104, 3, '#7aa7d8');
    }
    this.suitShape(this.width * 0.22, this.height * 0.27, 58, '#ffffff', 'heart');
    this.suitShape(this.width * 0.86, this.height * 0.22, 58, '#ffffff', 'club');
    this.suitShape(this.width * 0.9, this.height * 0.48, 62, '#ffffff', 'diamond');
    ctx.restore();
  }

  drawTableBackground() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(this.width / 2, this.height * 0.45, 20, this.width / 2, this.height * 0.45, this.height * 0.75);
    g.addColorStop(0, '#0b58a5');
    g.addColorStop(0.55, '#083978');
    g.addColorStop(1, '#071538');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = '#d79c43';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(this.width / 2, this.height / 2, this.width * 0.55, this.height * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawPlayerHeader(x, y, w) {
    const avatarSize = 58;
    this.avatar(x, y + 6, avatarSize, 'avatar');
    this.text(this.user?.nickname || '小牌手', x + 74, y + 26, 20, COLORS.white, '800');
    this.text('ID: 1002345', x + 74, y + 52, 14, COLORS.muted, '500');
    this.coinPill(x + w * 0.43, y + 10, w * 0.34, 46, this.user?.coin ?? 12345);
    this.iconLabel(x + w - 104, y + 4, 'book', '规则', () => {
      this.scene = 'rules';
    });
    this.iconLabel(x + w - 44, y + 4, 'gear', '设置', () => {
      this.scene = 'settings';
    });
  }

  drawLogo(cx, cy) {
    for (let i = 5; i > 0; i -= 1) this.text('U彩牌', cx + i, cy + i, 54, '#031022', '900', 'center');
    this.text('U', cx - 86, cy, 76, COLORS.gold, '900', 'center');
    this.text('彩牌', cx + 40, cy, 56, COLORS.white, '900', 'center');
    [COLORS.red, COLORS.gold, COLORS.green, COLORS.blue].forEach((color, i) => {
      this.miniCard(cx - 38 + i * 24, cy - 102 + (i % 2) * 8, 34, 48, color, String([1, 7, 3, 5][i]), -0.22 + i * 0.14);
    });
  }

  actionCard(x, y, w, h, color, dark, title, subtitle, icon, onTap) {
    this.shadow(() => this.roundRect(x, y + 5, w, h, 18, dark));
    const g = this.ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, this.lighten(color, 16));
    g.addColorStop(1, color);
    this.roundRect(x, y, w, h, 18, g, '#bfffd4', 2);
    this.drawLargeIcon(x + 42, y + h / 2, icon);
    this.text(title, x + 132, y + h / 2 - 2, 30, COLORS.white, '900');
    this.text(subtitle, x + 132, y + h / 2 + 27, 17, '#e7fff2', '700');
    this.chevron(x + w - 34, y + h / 2, 17, '#ffffff');
    this.hitAreas.push({ x, y, w, h, onTap });
  }

  smallInfoCard(x, y, w, h, bg, ink, title, subtitle, icon, onTap) {
    this.shadow(() => this.roundRect(x, y, w, h, 12, bg, '#ffffff', 2));
    this.drawSmallIcon(x + 35, y + 39, icon);
    this.text(title, x + 82, y + 31, 17, ink, '900');
    this.text(subtitle, x + 82, y + 55, 13, ink, '600');
    this.chevron(x + w - 22, y + h / 2, 10, ink);
    this.hitAreas.push({ x, y, w, h, onTap });
  }

  bottomNav(active) {
    const y = this.height - 70;
    this.roundRect(0, y, this.width, 70, 18, 'rgba(11,34,63,0.92)', '#49698d', 1.5);
    const tabs = [
      ['lobby', '首页', 'home'],
      ['tasks', '任务', 'task'],
      ['cardBacks', '牌背', 'cards'],
      ['profile', '我的', 'me']
    ];
    tabs.forEach(([scene, label, icon], index) => {
      const cx = this.width * (index + 0.5) / 4;
      const isActive = active === scene;
      if (isActive) {
        this.roundRect(cx - 48, y + 4, 96, 62, 14, 'rgba(255,255,255,0.08)');
        this.roundRect(cx - 34, y + 2, 68, 3, 2, COLORS.green);
      }
      this.navIcon(cx, y + 25, icon, isActive ? COLORS.green : '#afbed1');
      this.text(label, cx, y + 55, 15, isActive ? COLORS.white : '#b6c2d2', '800', 'center');
      this.hitAreas.push({ x: index * this.width / 4, y, w: this.width / 4, h: 70, onTap: () => { this.scene = scene; } });
    });
  }

  playerBadge(x, y, w, h, name, score, cards, position) {
    const active = this.game && this.currentPlayer().name === name;
    const avatarSize = position === 'top' ? 56 : 58;
    const ax = position === 'top' ? x + 8 : x - 18;
    this.roundRect(x, y, w, h, 16, active ? 'rgba(27,116,235,0.96)' : 'rgba(18,82,174,0.82)', active ? '#ffe066' : '#3f95ff', active ? 3 : 1.5);
    this.avatar(ax, y - 14, avatarSize, position === 'top' ? 'ai' : 'avatar');
    this.text(name, x + 76, y + 25, 20, COLORS.white, '900');
    this.coinMini(x + w - 58, y + 16, score);
    this.text(`手牌 ${cards} 张`, x + 78, y + 50, 13, '#d9e8ff', '700');
  }

  sidePlayer(x, y, name, score, cards) {
    const active = this.game && this.currentPlayer().name === name;
    this.roundRect(x, y, 68, 128, 16, active ? 'rgba(27,116,235,0.96)' : 'rgba(16,70,154,0.86)', active ? '#ffe066' : '#5ea7ff', active ? 3 : 1.5);
    this.avatar(x + 8, y + 8, 52, 'avatar');
    this.text(name, x + 34, y + 76, 17, COLORS.white, '900', 'center');
    this.coinMini(x + 16, y + 88, score);
    this.text(`手牌 ${cards} 张`, x + 34, y + 118, 12, '#dce9ff', '700', 'center');
    for (let i = 0; i < Math.min(cards, 5); i += 1) this.cardBack(x + 4, y + 142 + i * 22, 56, 78, 0);
  }

  colorPill(x, y, w, h, label) {
    this.roundRect(x, y, w, h, 17, 'rgba(3,31,75,0.82)');
    this.text(label, x + w / 2, y + 23, 16, '#d8e8ff', '900', 'center');
  }

  directionRing(cx, cy, r, color = '#5deaff') {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    const reverse = this.game?.direction === -1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, reverse ? Math.PI * 0.82 : -0.2, reverse ? Math.PI * 2.2 : Math.PI * 1.18, reverse);
    ctx.stroke();
    this.arrowHead(cx + Math.cos(reverse ? Math.PI * 0.82 : -0.2) * r, cy + Math.sin(reverse ? Math.PI * 0.82 : -0.2) * r, reverse ? -2.25 : 0.85, color);
    ctx.restore();
  }

  drawDeck(x, y, glow) {
    if (glow) {
      this.roundRect(x - 9, y - 9 + Math.sin(this.tick / 10) * 3, 88, 116, 14, 'rgba(255,224,102,0.18)', '#ffe066', 3);
    }
    for (let i = 7; i >= 0; i -= 1) this.cardBack(x + i * 1.6, y + i * 1.8, 70, 98, 0);
  }

  drawDiscard(x, y) {
    const card = this.game.discard;
    for (let i = 4; i >= 0; i -= 1) this.miniCard(x + i * 1.3, y + i * 1.5, 58, 88, CARD_COLORS[card.color], card.label, 0);
  }

  speechBubble(x, y, w, h, label) {
    this.roundRect(x, y, w, h, 18, '#fff0cb', '#ffffff', 2);
    this.text(label, x + w / 2, y + 27, Math.min(18, Math.max(12, 190 / String(label).length)), '#0b3b78', '900', 'center');
  }

  redButton(x, y, w, h, label, onTap) {
    const g = this.ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#ff705c');
    g.addColorStop(1, '#cd2f25');
    this.shadow(() => this.roundRect(x, y, w, h, 24, g, '#ffad98', 2));
    this.text(label, x + w / 2, y + 33, 24, COLORS.white, '900', 'center');
    this.hitAreas.push({ x, y, w, h, onTap });
  }

  turnHint(cx, y) {
    const text = this.currentPlayer().id === 'me' ? '<< 轮到你出牌 >>' : '等待对手出牌';
    this.text(text, cx, y, 20, '#ffe066', '900', 'center');
  }

  handCards(y) {
    const hand = this.me().hand;
    const cardW = 58;
    const gap = Math.min(42, Math.max(26, (this.width - 64 - cardW) / Math.max(1, hand.length - 1)));
    const start = this.width / 2 - (hand.length - 1) * gap / 2 - cardW / 2;
    const playableIds = new Set(this.playableCards().map((card) => card.id));
    hand.forEach((card, index) => {
      const selected = this.selectedCardId === card.id;
      const playable = playableIds.has(card.id) && this.currentPlayer().id === 'me';
      const x = start + index * gap;
      const rot = (index - (hand.length - 1) / 2) * 0.055;
      const autoLift = playable ? -18 : 0;
      const selectedLift = selected ? -44 : autoLift;
      const shake = this.shakeCardId === card.id && Date.now() < this.shakeUntil ? Math.sin(this.tick * 1.8) * 5 : 0;
      const rect = { x: x + shake, y: y + selectedLift, w: cardW, h: 94, card };
      this.handRects.push(rect);
      if (!this.drag || this.drag.cardId !== card.id) {
        this.playCardVisual(rect.x, rect.y, cardW, 90, CARD_COLORS[card.color], card.label, rot, selected || playable, playable ? 1 : 0.55);
      }
    });
    if (this.drag) {
      const card = hand.find((item) => item.id === this.drag.cardId);
      if (card) this.playCardVisual(this.drag.x - cardW / 2, this.drag.y - 50, cardW, 90, CARD_COLORS[card.color], card.label, 0, true, 1);
    }
  }

  playCardVisual(x, y, w, h, color, label, rotation, selected, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rotation);
    ctx.translate(-w / 2, -h / 2);
    if (selected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    this.roundRect(0, 0, w, h, 8, '#f9fbff', '#ffffff', 2);
    this.roundRect(4, 4, w - 8, h - 8, 7, color);
    ctx.save();
    ctx.globalAlpha *= 0.72;
    this.roundRect(12, 18, w - 24, h - 36, 6, 'rgba(255,255,255,0.72)');
    ctx.restore();
    const dark = color === CARD_COLORS.wild;
    this.text(label, w / 2, h / 2 + 12, label.length > 1 ? 24 : 34, dark ? '#ffffff' : '#073263', '900', 'center');
    this.text(label, 14, 23, 17, '#ffffff', '900', 'center');
    ctx.restore();
  }

  cardBack(x, y, w, h, rotation) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rotation);
    ctx.translate(-w / 2, -h / 2);
    this.roundRect(0, 0, w, h, 8, '#f4f2e7', '#ffffff', 2);
    this.roundRect(5, 5, w - 10, h - 10, 6, '#075fa9');
    this.roundRect(13, 16, w - 26, h - 32, 4, 'rgba(24,146,220,0.55)');
    this.text('U彩', w / 2, h / 2 + 7, 18, '#bde8ff', '900', 'center');
    ctx.restore();
  }

  miniCard(x, y, w, h, color, label, rotation) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rotation);
    ctx.translate(-w / 2, -h / 2);
    this.roundRect(0, 0, w, h, 7, '#ffffff', '#f2f2f2', 1);
    this.roundRect(4, 4, w - 8, h - 8, 5, color);
    this.text(label, w / 2, h / 2 + 11, label.length > 1 ? 20 : 26, '#ffffff', '900', 'center');
    ctx.restore();
  }

  avatar(x, y, size, key) {
    const image = this.assets.get(key);
    this.circle(x + size / 2, y + size / 2, size / 2 + 3, '#dbeaff');
    this.circle(x + size / 2, y + size / 2, size / 2, '#8bc3ff');
    if (image) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
      this.ctx.clip();
      this.ctx.drawImage(image, x, y, size, size);
      this.ctx.restore();
    } else {
      this.text('U', x + size / 2, y + size / 2 + size * 0.16, size * 0.48, COLORS.white, '900', 'center');
    }
  }

  coinPill(x, y, w, h, coin) {
    this.roundRect(x, y, w, h, h / 2, 'rgba(12,34,62,0.72)', '#234b77', 2);
    this.coin(x + 25, y + h / 2, 18);
    this.text(this.formatCoin(coin), x + 54, y + 30, 22, COLORS.white, '900');
    this.circle(x + w - 25, y + h / 2, 18, COLORS.green);
    this.text('+', x + w - 25, y + h / 2 + 8, 32, COLORS.white, '900', 'center');
  }

  coinMini(x, y, value) {
    this.coin(x + 10, y + 10, 9);
    this.text(String(value), x + 26, y + 16, 15, '#dbe9ff', '900');
  }

  coin(x, y, r) {
    this.circle(x, y, r, COLORS.gold, '#fff5a7', 2);
    this.circle(x, y, r * 0.68, COLORS.orange);
    this.text('$', x, y + r * 0.42, r * 1.1, '#ffeaa2', '900', 'center');
  }

  iconLabel(x, y, icon, label, onTap) {
    this.drawTinyIcon(x + 18, y + 22, icon, COLORS.white);
    this.text(label, x + 18, y + 55, 13, COLORS.white, '800', 'center');
    this.hitAreas.push({ x, y, w: 42, h: 62, onTap });
  }

  iconButton(x, y, size, icon, onTap) {
    this.roundRect(x, y, size, size, 10, 'rgba(30,105,199,0.8)', '#59a1ff', 1.5);
    this.drawTinyIcon(x + size / 2, y + size / 2, icon, COLORS.white);
    this.hitAreas.push({ x, y, w: size, h: size, onTap });
  }

  drawLargeIcon(cx, cy, icon) {
    if (icon === 'bot') {
      this.circle(cx, cy - 4, 31, '#eaf4ff');
      this.roundRect(cx - 30, cy - 17, 60, 34, 17, '#17263a');
      this.circle(cx - 12, cy, 5, '#66e96b');
      this.circle(cx + 12, cy, 5, '#66e96b');
      this.miniCard(cx - 10, cy + 13, 18, 28, COLORS.red, '', -0.2);
      this.miniCard(cx + 4, cy + 15, 18, 28, COLORS.green, '', 0.1);
      return;
    }
    if (icon === 'house') {
      this.roundRect(cx - 30, cy - 8, 60, 36, 7, '#eef7ff');
      this.triangle(cx - 36, cy - 7, cx, cy - 38, cx + 36, cy - 7, '#1f7fec');
      this.roundRect(cx - 8, cy + 5, 16, 23, 5, '#1472df');
      return;
    }
    this.circle(cx - 18, cy, 19, '#74d55a');
    this.circle(cx + 18, cy, 19, COLORS.gold);
    this.circle(cx, cy - 8, 24, COLORS.white);
    this.roundRect(cx - 34, cy + 11, 68, 22, 11, '#f7fbff');
  }

  drawSmallIcon(cx, cy, icon) {
    if (icon === 'trophy') {
      this.roundRect(cx - 16, cy - 14, 32, 30, 7, COLORS.gold);
      this.text('1', cx, cy + 7, 19, '#ffffff', '900', 'center');
      return;
    }
    this.coin(cx - 4, cy + 4, 14);
    this.coin(cx + 14, cy - 5, 13);
  }

  drawTinyIcon(cx, cy, icon, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    if (icon === 'book') {
      ctx.strokeRect(cx - 14, cy - 13, 12, 24);
      ctx.strokeRect(cx + 2, cy - 13, 12, 24);
      return;
    }
    if (icon === 'gear') {
      this.circle(cx, cy, 13, 'transparent', color, 4);
      this.circle(cx, cy, 4, color);
      return;
    }
    if (icon === 'back') {
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy - 14);
      ctx.lineTo(cx - 8, cy);
      ctx.lineTo(cx + 9, cy + 14);
      ctx.stroke();
      return;
    }
    this.circle(cx, cy, 12, color);
  }

  navIcon(cx, cy, icon, color) {
    this.drawTinyIcon(cx, cy - 4, icon === 'home' ? 'gear' : 'book', color);
  }

  chevron(x, y, size, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - size);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x - size / 2, y + size);
    ctx.stroke();
  }

  arrowHead(x, y, angle, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  suitShape(x, y, size, color, type) {
    if (type === 'diamond') {
      this.diamond(x, y, size, color);
      return;
    }
    this.circle(x - size * 0.18, y, size * 0.24, color);
    this.circle(x + size * 0.18, y, size * 0.24, color);
    this.circle(x, y + size * 0.16, size * 0.28, color);
    this.triangle(x - size * 0.34, y + size * 0.18, x + size * 0.34, y + size * 0.18, x, y + size * 0.58, color);
  }

  shadow(draw) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    draw();
    ctx.restore();
  }

  roundRect(x, y, w, h, r, fill, stroke, lineWidth = 0) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  circle(x, y, r, fill, stroke, lineWidth = 0) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  triangle(x1, y1, x2, y2, x3, y3, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  diamond(x, y, size, color) {
    this.triangle(x, y - size / 2, x + size / 2, y, x, y + size / 2, color);
    this.triangle(x, y - size / 2, x - size / 2, y, x, y + size / 2, color);
  }

  text(value, x, y, size, color, weight = '400', align = 'left') {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  lighten(hex, amount) {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amount);
    const g = Math.min(255, ((n >> 8) & 255) + amount);
    const b = Math.min(255, (n & 255) + amount);
    return `rgb(${r}, ${g}, ${b})`;
  }

  colorName(color) {
    return { red: '红色', yellow: '黄色', blue: '蓝色', green: '绿色', wild: '万能' }[color] ?? color;
  }

  cardName(card) {
    return `${this.colorName(card.color)} ${card.label}`;
  }

  formatCoin(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  toast(title) {
    this.toastText = title;
    this.toastUntil = Date.now() + 1500;
    if (wx.showToast) {
      wx.showToast({ title, icon: 'none' });
    }
  }

  drawToast() {
    if (!this.toastText || Date.now() > this.toastUntil) {
      return;
    }
    const w = Math.min(this.width - 60, this.toastText.length * 16 + 42);
    const x = (this.width - w) / 2;
    const y = this.height * 0.16;
    this.roundRect(x, y, w, 38, 19, 'rgba(0,0,0,0.62)');
    this.text(this.toastText, this.width / 2, y + 25, 15, COLORS.white, '800', 'center');
  }
}
