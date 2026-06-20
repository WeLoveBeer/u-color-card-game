import { WechatCanvasRenderDriver } from './WechatCanvasRenderDriver.js';
import { LocalDemoGame } from './LocalDemoGame.js';
import {
  DEFAULT_RULE_CONFIG,
  renderCreateRoom,
  renderJoinRoom,
  renderRoom,
  renderServerGame,
  viewport
} from './WechatRoomViews.js';

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
    this.renderDriver = new WechatCanvasRenderDriver(this.ctx, {
      imageResolver: (assetKey) => this.assets.get(assetKey) ?? null
    });
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
    this.gameMode = 'local';
    this.room = null;
    this.serverGameState = null;
    this.roomConfig = { ...DEFAULT_RULE_CONFIG };
    this.joinRoomInput = '';
    this.recentRooms = [];
    this.selectedServerCardId = null;
    this.pendingColorCardId = null;
    this.socket = null;
    this.socketConnected = false;
    this.socketSeq = 1;
    this.lastServerSeq = 0;
    this.aiTimer = null;
    this.localDemo = new LocalDemoGame();
    this.loginPromise = null;
    this.lastLoginError = '';
  }

  async start() {
    this.resize();
    this.applyLaunchOptions();
    await this.loadAssets();
    this.bindTouch();
    this.login();
    this.loop();
  }

  applyLaunchOptions() {
    const options = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : null;
    const roomId = options?.query?.roomId;
    if (roomId) {
      this.joinRoomInput = String(roomId).trim().toUpperCase();
      this.scene = 'join_room';
    }
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
      ai: `${this.options.assetsBase}/avatars/ai_wave.svg`,
      'avatar.player.default': `${this.options.assetsBase}/avatars/player_default.svg`,
      'avatar.ai.wave': `${this.options.assetsBase}/avatars/ai_wave.svg`,
      'background.lobby': `${this.options.assetsBase}/backgrounds/lobby_bg.svg`,
      'background.table': `${this.options.assetsBase}/backgrounds/table_bg.svg`,
      'card_back.default': `${this.options.assetsBase}/cards/card_back_default.svg`,
      'card.wild.color': `${this.options.assetsBase}/cards/wild_color.svg`,
      'card.wild.plus4': `${this.options.assetsBase}/cards/wild_plus4.svg`
    };
    for (const color of ['red', 'yellow', 'blue', 'green']) {
      for (let value = 0; value <= 9; value += 1) {
        assets[`card.${color}.${value}`] = `${this.options.assetsBase}/cards/${color}_${value}.svg`;
      }
      for (const type of ['skip', 'reverse', 'plus2']) {
        assets[`card.${color}.${type}`] = `${this.options.assetsBase}/cards/${color}_${type}.svg`;
      }
    }
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
    this.loginPromise = new Promise((resolve) => {
      wx.login({
        success: async ({ code }) => {
          try {
            const response = await this.request('/auth/wechat-login', { code });
            if (response.success) {
              this.user = response.data.user;
              this.lastLoginError = '';
              resolve(true);
              return;
            }
            this.lastLoginError = response.error?.message || '服务器拒绝登录';
          } catch (error) {
            this.lastLoginError = this.errorMessage(error);
            this.toast(`离线模式：${this.lastLoginError}`);
          }
          resolve(false);
        },
        fail: (error) => {
          this.lastLoginError = this.errorMessage(error);
          this.toast(`离线模式：${this.lastLoginError}`);
          resolve(false);
        }
      });
    });
    return this.loginPromise;
  }

  request(path, body) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.options.apiBase}${path}`,
        method: 'POST',
        data: body,
        header: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
        },
        success: (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          if (response.data?.data?.token) {
            this.token = response.data.data.token;
          }
          resolve(response.data);
        },
        fail: (error) => {
          reject(new Error(this.errorMessage(error)));
        }
      });
    });
  }

  errorMessage(error) {
    if (!error) {
      return '未知错误';
    }
    if (typeof error === 'string') {
      return error;
    }
    return error.errMsg || error.message || '网络请求失败';
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
    if (this.scene === 'game' && this.gameMode === 'local') {
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
    } else if (this.scene === 'game' && this.gameMode === 'local') {
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
    const width = area.w ?? area.width;
    const height = area.h ?? area.height;
    return x >= area.x && x <= area.x + width && y >= area.y && y <= area.y + height;
  }

  loop() {
    this.tick += 1;
    this.hitAreas = [];
    this.handRects = [];
    this.dropZone = null;
    if (this.scene === 'game' && this.gameMode === 'local') {
      this.drawGame();
    } else if (this.scene === 'game' && this.gameMode === 'server') {
      this.drawServerGame();
    } else if (this.scene === 'create_room') {
      this.drawCreateRoom();
    } else if (this.scene === 'join_room') {
      this.drawJoinRoom();
    } else if (this.scene === 'room') {
      this.drawRoom();
    } else if (this.scene === 'result') {
      this.drawServerGame();
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
    this.game = this.localDemo.create();
    this.gameMode = 'local';
    this.serverGameState = null;
    this.selectedCardId = null;
    this.clearAiTimer();
    this.scene = 'game';
    this.scheduleAiTurn();
  }

  drawCreateRoom() {
    const tree = renderCreateRoom(this.roomConfig, viewport(this));
    this.renderDriver.draw(tree);
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  drawJoinRoom() {
    const tree = renderJoinRoom(this.joinRoomInput, this.recentRooms, viewport(this));
    this.renderDriver.draw(tree);
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  drawRoom() {
    if (!this.room) {
      this.scene = 'lobby';
      this.toast('房间状态为空');
      return;
    }
    const tree = renderRoom(this.room, this.user?.id, viewport(this));
    this.renderDriver.draw(tree);
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  drawServerGame() {
    if (!this.serverGameState) {
      this.scene = this.room ? 'room' : 'lobby';
      return;
    }
    const tree = renderServerGame(this.serverGameState, this.user?.id, this.selectedServerCardId, this.pendingColorCardId, viewport(this));
    this.renderDriver.draw(tree);
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  createDeck() {
    return this.localDemo.createDeck();
  }

  shuffle(items) {
    this.localDemo.shuffle(items);
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
    this.scheduleAiTurn();
  }

  scheduleAiTurn() {
    this.clearAiTimer();
    if (!this.game || this.game.finished || this.currentPlayer().id === 'me') {
      if (this.game && !this.game.finished && this.currentPlayer().id === 'me') {
        this.game.message = this.playableCards().length > 0 ? '轮到你出牌' : '无可出牌，点击牌堆摸牌';
      }
      return;
    }
    const expectedIndex = this.game.currentIndex;
    const delay = 900 + Math.floor(Math.random() * 901);
    this.game.message = `${this.currentPlayer().name} 思考中`;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      this.runAiTurn(expectedIndex);
    }, delay);
  }

  clearAiTimer() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  runAiTurn(expectedIndex) {
    if (!this.game || this.game.finished || this.game.currentIndex !== expectedIndex || this.currentPlayer().id === 'me') {
      return;
    }
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
      this.scheduleAiTurn();
    }
    if (!this.game.finished && this.currentPlayer().id === 'me') {
      this.game.message = this.playableCards().length > 0 ? '轮到你出牌' : '无可出牌，点击牌堆摸牌';
    }
  }

  drawTo(player, count) {
    this.localDemo.drawTo(this.game, player, count);
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
    this.localDemo.advanceTurn(this.game);
  }

  currentPlayer() {
    return this.localDemo.currentPlayer(this.game);
  }

  me() {
    return this.localDemo.me(this.game);
  }

  playableCards() {
    return this.localDemo.playableCards(this.game);
  }

  isPlayable(card) {
    return this.localDemo.isPlayable(this.game, card);
  }

  recommendColor(hand) {
    return this.localDemo.recommendColor(hand);
  }

  drawLobby() {
    const tree = this.buildLobbyRenderTree();
    this.renderDriver.draw(tree);
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  buildLobbyRenderTree() {
    const safeTop = 0;
    const safeBottom = 0;
    const margin = Math.max(18, Math.round(this.width * 0.045));
    const topBar = { x: margin, y: safeTop + 18, width: this.width - margin * 2, height: 78 };
    const commands = [
      { type: 'rect', id: 'lobby-bg-color', rect: { x: 0, y: 0, width: this.width, height: this.height }, fill: '#e8fbf4' },
      { type: 'image', id: 'lobby-bg', assetKey: 'background.lobby', rect: { x: 0, y: 0, width: this.width, height: this.height }, alpha: 0.92 },
      { type: 'rect', id: 'lobby-top-bar', rect: topBar, fill: 'rgba(255,255,255,0.90)', radius: 16, stroke: '#bae6fd', lineWidth: 1 },
      { type: 'circle', id: 'lobby-avatar', x: topBar.x + 36, y: topBar.y + topBar.height / 2, radius: 24, fill: '#38bdf8' },
      { type: 'text', id: 'lobby-nickname', text: this.user?.nickname ?? '小牌手', x: topBar.x + 74, y: topBar.y + 34, fontSize: 22, color: '#0f172a', align: 'left', weight: 'medium', maxWidth: topBar.width - 210 },
      { type: 'text', id: 'lobby-coin', text: `${this.formatCoin(this.user?.coin ?? 0)} 金币`, x: topBar.x + 74, y: topBar.y + 62, fontSize: 18, color: '#0f766e', align: 'left' },
      { type: 'text', id: 'lobby-rules', text: '规则', x: topBar.x + topBar.width - 92, y: topBar.y + 48, fontSize: 18, color: '#075985', align: 'center', weight: 'medium' },
      { type: 'text', id: 'lobby-settings', text: '设置', x: topBar.x + topBar.width - 36, y: topBar.y + 48, fontSize: 18, color: '#075985', align: 'center', weight: 'medium' }
    ];
    const hitAreas = [
      { id: 'hit-rules', action: 'rules', rect: { x: topBar.x + topBar.width - 120, y: topBar.y + 10, width: 54, height: 58 } },
      { id: 'hit-settings', action: 'settings', rect: { x: topBar.x + topBar.width - 64, y: topBar.y + 10, width: 54, height: 58 } }
    ];

    const titleY = topBar.y + topBar.height + 70;
    commands.push(
      { type: 'text', id: 'lobby-title-u', text: 'U', x: this.width / 2 - 70, y: titleY, fontSize: 70, color: '#facc15', align: 'center', weight: 'bold' },
      { type: 'text', id: 'lobby-title', text: '彩牌', x: this.width / 2 + 28, y: titleY - 4, fontSize: 50, color: '#0f766e', align: 'center', weight: 'bold' }
    );

    const primaryTop = Math.max(titleY + 54, this.height * 0.30);
    const primaryActions = [
      ['quick_ai', '快速人机', '离线也能练习出牌', '#16a34a'],
      ['create_room', '创建房间', '邀请好友，欢乐开局', '#2563eb'],
      ['join_room', '加入房间', '输入房号，加入对局', '#0d9488']
    ];
    primaryActions.forEach(([action, title, subtitle, fill], index) => {
      const rect = { x: margin, y: primaryTop + index * 100, width: this.width - margin * 2, height: 82 };
      commands.push(
        { type: 'rect', id: `primary-${action}`, rect, fill, radius: 18 },
        { type: 'text', id: `primary-${action}-title`, text: title, x: rect.x + 32, y: rect.y + 34, fontSize: 28, color: '#ffffff', align: 'left', weight: 'bold' },
        { type: 'text', id: `primary-${action}-subtitle`, text: subtitle, x: rect.x + 32, y: rect.y + 63, fontSize: 17, color: 'rgba(255,255,255,0.86)', align: 'left' },
        { type: 'text', id: `primary-${action}-arrow`, text: '>', x: rect.x + rect.width - 30, y: rect.y + 52, fontSize: 30, color: '#ffffff', align: 'center', weight: 'bold' }
      );
      hitAreas.push({ id: `hit-${action}`, action, rect });
    });

    const secondaryY = primaryTop + 310;
    const secondaryWidth = (this.width - margin * 2 - 12) / 2;
    [
      ['leaderboard', '金币排行榜', '高手云集，等你上榜', '#fff7d6', '#7c4a10'],
      ['daily_reward', '每日奖励', '登录领取金币', '#dff3ff', '#153d78']
    ].forEach(([action, title, subtitle, fill, ink], index) => {
      const rect = { x: margin + index * (secondaryWidth + 12), y: secondaryY, width: secondaryWidth, height: 78 };
      commands.push(
        { type: 'rect', id: `secondary-${action}`, rect, fill, radius: 14, stroke: '#ffffff', lineWidth: 2 },
        { type: 'text', id: `secondary-${action}-title`, text: title, x: rect.x + 16, y: rect.y + 31, fontSize: 18, color: ink, align: 'left', weight: 'bold', maxWidth: rect.width - 28 },
        { type: 'text', id: `secondary-${action}-subtitle`, text: subtitle, x: rect.x + 16, y: rect.y + 56, fontSize: 13, color: ink, align: 'left', maxWidth: rect.width - 28 }
      );
      hitAreas.push({ id: `hit-${action}`, action, rect });
    });

    const tabTop = this.height - safeBottom - 70;
    commands.push({ type: 'rect', id: 'bottom-tabs-bg', rect: { x: 0, y: tabTop, width: this.width, height: 70 }, fill: 'rgba(11,34,63,0.92)', radius: 18 });
    ['首页', '任务', '牌背', '我的'].forEach((label, index) => {
      const rect = { x: index * this.width / 4, y: tabTop, width: this.width / 4, height: 70 };
      commands.push({ type: 'text', id: `tab-${index}`, text: label, x: rect.x + rect.width / 2, y: rect.y + 44, fontSize: 15, color: index === 0 ? '#ffffff' : '#b6c2d2', align: 'center', weight: index === 0 ? 'bold' : 'medium' });
      hitAreas.push({ id: `hit-tab-${index}`, action: ['lobby', 'tasks', 'cardBacks', 'profile'][index], rect });
    });

    return { width: this.width, height: this.height, commands, hitAreas };
  }

  toWechatHitArea(area) {
    return {
      x: area.rect.x,
      y: area.rect.y,
      w: area.rect.width,
      h: area.rect.height,
      onTap: () => this.handleRenderAction(area.action, area.payload)
    };
  }

  handleRenderAction(action, payload = {}) {
    if (action === 'quick_ai') {
      this.startLocalGame();
    } else if (action === 'draw_card') {
      this.drawCard();
    } else if (action === 'server_draw_card') {
      this.sendWs({ type: 'draw_card', data: { roomId: this.serverGameState?.roomId } });
    } else if (action === 'server_select_card') {
      this.selectServerCard(payload.cardId);
    } else if (action === 'server_choose_color') {
      this.playServerCard(payload.cardId, payload.color);
    } else if (action === 'server_call_u') {
      this.sendWs({ type: 'call_u', data: { roomId: this.serverGameState?.roomId } });
    } else if (action === 'select_card') {
      this.tapCard(payload.cardId);
    } else if (action === 'call_u') {
      this.callU();
    } else if (action === 'restart_local_game') {
      this.startLocalGame();
    } else if (action === 'create_room') {
      this.roomConfig = { ...DEFAULT_RULE_CONFIG };
      this.scene = 'create_room';
    } else if (action === 'join_room') {
      this.scene = 'join_room';
    } else if (action === 'set_room_config') {
      this.roomConfig = { ...this.roomConfig, [payload.key]: payload.value };
    } else if (action === 'toggle_room_config') {
      this.roomConfig = { ...this.roomConfig, [payload.key]: !this.roomConfig[payload.key] };
    } else if (action === 'create_room_submit') {
      this.createFriendRoom();
    } else if (action === 'edit_room_id') {
      this.promptRoomId();
    } else if (action === 'join_room_submit') {
      if (!payload.disabled) {
        this.joinFriendRoom(this.joinRoomInput);
      }
    } else if (action === 'rejoin_room') {
      this.joinFriendRoom(payload.roomId);
    } else if (action === 'copy_room_id') {
      this.copyRoomId();
    } else if (action === 'share_room') {
      this.shareRoom();
    } else if (action === 'leave_room') {
      this.leaveRoom();
    } else if (action === 'ready') {
      this.sendWs({ type: 'ready', data: { roomId: this.room?.roomId, ready: true } });
    } else if (action === 'cancel_ready') {
      this.sendWs({ type: 'ready', data: { roomId: this.room?.roomId, ready: false } });
    } else if (action === 'start_game') {
      if (!payload.disabled) {
        this.sendWs({ type: 'start_game', data: { roomId: this.room?.roomId } });
      }
    } else if (action === 'invite_to_seat') {
      this.shareRoom();
    } else if (action === 'send_quick_message') {
      this.toast(payload.message || '已发送');
    } else if (action === 'room') {
      this.scene = this.room ? 'room' : 'lobby';
    } else if (action === 'leaderboard') {
      this.scene = 'leaderboard';
    } else if (action === 'daily_reward') {
      this.user.coin += 100;
      this.toast('金币 +100');
    } else if (action === 'rules' || action === 'settings' || action === 'tasks' || action === 'cardBacks' || action === 'profile' || action === 'lobby') {
      this.scene = action;
    }
  }

  async createFriendRoom() {
    try {
      this.toast('正在创建房间...');
      if (!this.token) {
        await this.login();
      }
      if (!this.token) {
        this.toast(`登录失败：${this.lastLoginError || '请检查服务器连接'}`);
        return;
      }
      const response = await this.request('/rooms', this.roomConfig);
      if (!response.success) {
        this.toast(response.error?.message || '创建房间失败');
        return;
      }
      this.addRecentRoom(response.data.roomId, this.roomConfig);
      await this.joinFriendRoom(response.data.roomId);
    } catch (error) {
      this.toast(`创建房间失败：${this.errorMessage(error)}`);
    }
  }

  defaultRoomConfig() {
    return { ...DEFAULT_RULE_CONFIG };
  }

  async promptRoomId() {
    if (!wx.showModal) {
      this.toast('当前环境不支持输入');
      return;
    }
    wx.showModal({
      title: '输入房号',
      editable: true,
      placeholderText: '例如 123456',
      content: this.joinRoomInput,
      success: (result) => {
        if (result.confirm) {
          this.joinRoomInput = String(result.content || '').trim().toUpperCase();
        }
      }
    });
  }

  async joinFriendRoom(roomId) {
    const normalized = String(roomId || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(normalized)) {
      this.toast('房号格式不正确');
      return;
    }
    try {
      this.toast('正在进入房间...');
      await this.ensureLoggedIn();
      await this.ensureSocket();
      this.joinRoomInput = normalized;
      this.sendWs({ type: 'join_room', data: { roomId: normalized } });
    } catch (error) {
      this.toast(`进入房间失败：${this.errorMessage(error)}`);
    }
  }

  async ensureLoggedIn() {
    if (this.token) {
      return true;
    }
    await this.login();
    if (!this.token) {
      throw new Error(this.lastLoginError || '登录失败');
    }
    return true;
  }

  ensureSocket() {
    if (this.socket && this.socketConnected) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const url = this.socketUrl();
      const task = wx.connectSocket({ url });
      this.socket = task;
      this.socketConnected = false;
      let settled = false;
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(new Error(this.errorMessage(error)));
        }
      };
      task.onOpen(() => {
        this.socketConnected = true;
      });
      task.onMessage((event) => {
        this.handleSocketFrame(String(event.data || ''));
        if (!settled && this.socketConnected) {
          settled = true;
          resolve();
        }
      });
      task.onClose(() => {
        this.socketConnected = false;
      });
      task.onError(fail);
      setTimeout(() => fail(new Error('连接超时')), 8000);
    });
  }

  socketUrl() {
    let base = this.options.wsBase || this.options.apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws');
    if (!base.includes('?') && !base.endsWith('/')) {
      base += '/';
    }
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}EIO=4&transport=websocket&token=${encodeURIComponent(this.token || '')}`;
  }

  handleSocketFrame(frame) {
    if (frame.startsWith('0')) {
      this.socket?.send({ data: '40' });
      return;
    }
    if (frame === '2') {
      this.socket?.send({ data: '3' });
      return;
    }
    if (frame.startsWith('40')) {
      this.socketConnected = true;
      return;
    }
    if (!frame.startsWith('42')) {
      return;
    }
    try {
      const [eventName, payload] = JSON.parse(frame.slice(2));
      if (eventName === 'message') {
        this.handleServerMessage(payload);
      }
    } catch (error) {
      this.toast(`消息解析失败：${this.errorMessage(error)}`);
    }
  }

  sendWs(message) {
    if (!message?.data?.roomId) {
      this.toast('房间状态未就绪');
      return null;
    }
    if (!this.socket || !this.socketConnected) {
      this.toast('连接未就绪');
      return null;
    }
    const seq = this.socketSeq++;
    this.socket.send({ data: `42${JSON.stringify(['message', { ...message, seq }])}` });
    return seq;
  }

  handleServerMessage(message) {
    if (!message) {
      return;
    }
    if (message.seq) {
      this.lastServerSeq = Math.max(this.lastServerSeq, message.seq);
    }
    if (message.type === 'error') {
      this.toast(message.error?.message || '操作失败');
      return;
    }
    if (message.type === 'room_state') {
      this.room = message.data;
      this.addRecentRoom(message.data.roomId, message.data.config, message.data.status);
      if (!this.serverGameState || message.data.status !== 'playing') {
        this.scene = 'room';
      }
      return;
    }
    if (message.type === 'game_start') {
      this.serverGameState = message.data.state;
      this.gameMode = 'server';
      this.selectedServerCardId = null;
      this.pendingColorCardId = null;
      this.scene = 'game';
      return;
    }
    if (message.type === 'game_state') {
      this.serverGameState = message.data;
      this.gameMode = 'server';
      this.scene = 'game';
      return;
    }
    if (message.data?.state) {
      this.serverGameState = message.data.state;
      this.gameMode = 'server';
      this.scene = message.data.state.status === 'finished' ? 'result' : 'game';
    }
    if (message.type === 'game_over') {
      this.scene = 'result';
    }
  }

  selectServerCard(cardId) {
    const card = this.serverGameState?.myHand?.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    if (this.selectedServerCardId !== cardId) {
      this.selectedServerCardId = cardId;
      this.toast('再次点击确认出牌');
      return;
    }
    if (card.type === 'wild_color' || card.type === 'wild_plus_four') {
      this.pendingColorCardId = cardId;
      return;
    }
    this.playServerCard(cardId);
  }

  playServerCard(cardId, chooseColor) {
    this.sendWs({ type: 'play_card', data: { roomId: this.serverGameState?.roomId, cardIds: [cardId], ...(chooseColor ? { chooseColor } : {}) } });
    this.selectedServerCardId = null;
    this.pendingColorCardId = null;
  }

  addRecentRoom(roomId, config = this.roomConfig, status = 'waiting') {
    const item = {
      roomId,
      playerCount: config.playerCount,
      maxPlayers: config.playerCount,
      status,
      statusText: status === 'playing' ? '对局中' : status === 'finished' ? '已结束' : '等待中',
      lastJoinedAt: new Date().toISOString()
    };
    this.recentRooms = [item, ...this.recentRooms.filter((room) => room.roomId !== roomId)].slice(0, 5);
  }

  copyRoomId() {
    const roomId = this.room?.roomId;
    if (!roomId) {
      return;
    }
    if (wx.setClipboardData) {
      wx.setClipboardData({ data: roomId });
    }
    this.toast(`房号 ${roomId} 已复制`);
  }

  shareRoom() {
    const roomId = this.room?.roomId;
    if (wx.shareAppMessage && roomId) {
      wx.shareAppMessage({ title: `加入 U彩牌房间 ${roomId}`, query: `roomId=${roomId}` });
    }
    this.toast(roomId ? `分享房间 ${roomId}` : '暂无房间可分享');
  }

  leaveRoom() {
    if (this.room?.roomId) {
      this.sendWs({ type: 'leave_room', data: { roomId: this.room.roomId } });
    }
    this.room = null;
    this.serverGameState = null;
    this.gameMode = 'local';
    this.scene = 'lobby';
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
    const tree = this.buildGameRenderTree();
    this.renderDriver.draw(tree);
    this.handRects.push(...tree.handRects);
    this.dropZone = tree.dropZone;
    this.hitAreas.push(...tree.hitAreas.map((area) => this.toWechatHitArea(area)));
  }

  buildGameRenderTree() {
    const w = this.width;
    const h = this.height;
    const margin = Math.max(16, Math.round(w * 0.04));
    const commands = [
      { type: 'rect', id: 'game-bg', rect: { x: 0, y: 0, width: w, height: h }, fill: '#071538' },
      { type: 'image', id: 'table-bg', assetKey: 'background.table', rect: { x: 0, y: 0, width: w, height: h }, alpha: 0.9 },
      { type: 'rect', id: 'top-bar', rect: { x: margin, y: 18, width: w - margin * 2, height: 58 }, fill: 'rgba(8,47,73,0.72)', radius: 14 },
      { type: 'text', id: 'game-prompt', text: this.game.message, x: margin + 18, y: 55, fontSize: 20, color: '#ffffff', align: 'left', weight: 'medium', maxWidth: w - margin * 2 - 150 },
      { type: 'text', id: 'game-rules', text: '规则', x: w - margin - 92, y: 54, fontSize: 17, color: '#ffffff', align: 'center' },
      { type: 'text', id: 'game-settings', text: '设置', x: w - margin - 36, y: 54, fontSize: 17, color: '#ffffff', align: 'center' }
    ];
    const hitAreas = [
      { id: 'hit-rules', action: 'rules', rect: { x: w - margin - 120, y: 24, width: 54, height: 44 } },
      { id: 'hit-settings', action: 'settings', rect: { x: w - margin - 64, y: 24, width: 54, height: 44 } }
    ];
    const handRects = [];
    this.pushSeatCommands(commands, this.game.players[1], { x: w / 2 - 92, y: 92, width: 184, height: 62 }, 'top');
    this.pushSeatCommands(commands, this.game.players[2], { x: 8, y: h * 0.29, width: 76, height: 118 }, 'side');
    this.pushSeatCommands(commands, this.game.players[3], { x: w - 84, y: h * 0.29, width: 76, height: 118 }, 'side');
    commands.push(
      { type: 'rect', id: 'color-pill', rect: { x: w / 2 - 74, y: h * 0.24, width: 148, height: 34 }, fill: 'rgba(3,31,75,0.82)', radius: 17 },
      { type: 'text', id: 'color-pill-text', text: `当前颜色：${this.colorName(this.game.currentColor)}`, x: w / 2, y: h * 0.24 + 23, fontSize: 16, color: '#d8e8ff', align: 'center', weight: 'bold' }
    );
    const centerX = w / 2;
    const centerY = h * 0.43;
    const ringRadius = Math.min(w * 0.27, 116);
    commands.push(
      { type: 'arc', id: 'direction-ring', x: centerX, y: centerY, radius: ringRadius, startAngle: -0.45, endAngle: Math.PI * 1.78, stroke: CARD_COLORS[this.game.currentColor], lineWidth: 10 },
      { type: 'text', id: 'direction-arrow', text: this.game.direction > 0 ? '>' : '<', x: centerX + ringRadius - 8, y: centerY - 4, fontSize: 28, color: '#ffffff', align: 'center', weight: 'bold' }
    );
    const cardW = Math.min(86, w * 0.22);
    const cardH = Math.round(cardW * 1.42);
    const drawPile = { x: centerX - cardW - 22, y: centerY - cardH / 2, width: cardW, height: cardH };
    const discardPile = { x: centerX + 22, y: centerY - cardH / 2, width: cardW, height: cardH };
    const drawHighlighted = this.currentPlayer().id === 'me' && this.playableCards().length === 0;
    if (drawHighlighted) {
      commands.push({ type: 'rect', id: 'draw-glow', rect: this.inflateRect(drawPile, 8), fill: 'rgba(250,204,21,0.18)', radius: 14, stroke: '#facc15', lineWidth: 3 });
    }
    commands.push(
      { type: 'image', id: 'draw-pile', assetKey: 'card_back.default', rect: drawPile, alpha: drawHighlighted ? 1 : 0.86 },
      { type: 'image', id: 'discard-pile', assetKey: this.cardAssetKey(this.game.discard), rect: discardPile },
      { type: 'text', id: 'deck-count', text: String(this.game.deck.length), x: drawPile.x + drawPile.width / 2, y: drawPile.y + drawPile.height + 24, fontSize: 18, color: '#e0f2fe', align: 'center', weight: 'bold' }
    );
    hitAreas.push({ id: 'hit-draw-pile', action: 'draw_card', rect: drawPile });
    const dropZone = { x: discardPile.x - 24, y: discardPile.y - 24, w: discardPile.width + 48, h: discardPile.height + 48 };
    if (this.drag?.active) {
      commands.push({ type: 'rect', id: 'drop-zone', rect: { x: dropZone.x, y: dropZone.y, width: dropZone.w, height: dropZone.h }, fill: 'rgba(93,234,255,0.16)', radius: 18, stroke: '#5deaff', lineWidth: 3 });
    }
    const localPanel = { x: margin, y: h * 0.64, width: w - margin * 2, height: 68 };
    commands.push(
      { type: 'rect', id: 'local-panel', rect: localPanel, fill: this.currentPlayer().id === 'me' ? 'rgba(14,116,144,0.88)' : 'rgba(8,47,73,0.78)', radius: 17, stroke: this.currentPlayer().id === 'me' ? '#facc15' : '#7dd3fc', lineWidth: 2 },
      { type: 'text', id: 'local-title', text: `我 · 手牌 ${this.me().hand.length} 张`, x: localPanel.x + 20, y: localPanel.y + 29, fontSize: 20, color: '#ffffff', align: 'left', weight: 'bold' },
      { type: 'text', id: 'local-timer', text: `${this.turnSecondsLeft()}s`, x: localPanel.x + 20, y: localPanel.y + 54, fontSize: 18, color: this.turnSecondsLeft() <= 5 ? '#fca5a5' : '#dff7ff', align: 'left', weight: 'medium' },
      { type: 'rect', id: 'call-u-button', rect: { x: localPanel.x + localPanel.width - 102, y: localPanel.y + 12, width: 88, height: 44 }, fill: '#ef4444', radius: 14 },
      { type: 'text', id: 'call-u-text', text: '喊 U', x: localPanel.x + localPanel.width - 58, y: localPanel.y + 41, fontSize: 22, color: '#ffffff', align: 'center', weight: 'bold' }
    );
    hitAreas.push({ id: 'hit-call-u', action: 'call_u', rect: { x: localPanel.x + localPanel.width - 102, y: localPanel.y + 12, width: 88, height: 44 } });
    commands.push({ type: 'text', id: 'turn-hint', text: this.currentPlayer().id === 'me' ? '轮到你出牌' : '等待对手出牌', x: w / 2, y: h * 0.75, fontSize: 20, color: '#ffe066', align: 'center', weight: 'bold' });
    this.pushHandCommands(commands, hitAreas, handRects, h - 126);
    if (this.game.finished) {
      const overlay = { x: 32, y: h * 0.34, width: w - 64, height: 150 };
      commands.push(
        { type: 'rect', id: 'result-overlay', rect: overlay, fill: 'rgba(5,23,50,0.92)', radius: 18, stroke: '#7bb7ff', lineWidth: 2 },
        { type: 'text', id: 'result-message', text: this.game.message, x: w / 2, y: overlay.y + 60, fontSize: 26, color: '#ffffff', align: 'center', weight: 'bold', maxWidth: overlay.width - 32 },
        { type: 'rect', id: 'restart-button', rect: { x: w / 2 - 84, y: overlay.y + 88, width: 168, height: 44 }, fill: COLORS.green, radius: 12, stroke: '#a3ffb4', lineWidth: 2 },
        { type: 'text', id: 'restart-text', text: '再来一局', x: w / 2, y: overlay.y + 117, fontSize: 21, color: '#ffffff', align: 'center', weight: 'bold' }
      );
      hitAreas.push({ id: 'hit-restart', action: 'restart_local_game', rect: { x: w / 2 - 84, y: overlay.y + 88, width: 168, height: 44 } });
    }
    return { width: w, height: h, commands, hitAreas, handRects, dropZone };
  }

  pushSeatCommands(commands, player, rect, mode) {
    const active = this.game && this.currentPlayer().id === player.id;
    commands.push(
      { type: 'rect', id: `seat-${player.id}`, rect, fill: active ? 'rgba(250,204,21,0.26)' : 'rgba(8,47,73,0.68)', radius: 16, stroke: active ? '#facc15' : '#7dd3fc', lineWidth: active ? 3 : 1 },
      { type: 'circle', id: `seat-${player.id}-avatar`, x: mode === 'top' ? rect.x + 34 : rect.x + rect.width / 2, y: mode === 'top' ? rect.y + rect.height / 2 : rect.y + 28, radius: mode === 'top' ? 23 : 24, fill: '#38bdf8' }
    );
    if (mode === 'top') {
      commands.push(
        { type: 'text', id: `seat-${player.id}-name`, text: player.name, x: rect.x + 68, y: rect.y + 27, fontSize: 18, color: '#ffffff', align: 'left', weight: 'bold' },
        { type: 'text', id: `seat-${player.id}-count`, text: `${player.hand.length} 张`, x: rect.x + 68, y: rect.y + 50, fontSize: 14, color: '#dff7ff', align: 'left' }
      );
      if (active) {
        commands.push({ type: 'text', id: `seat-${player.id}-timer`, text: `思考中 ${this.turnSecondsLeft()}s`, x: rect.x + rect.width - 12, y: rect.y + 25, fontSize: 13, color: '#fde68a', align: 'right', weight: 'bold' });
      }
      return;
    }
    commands.push(
      { type: 'text', id: `seat-${player.id}-name`, text: player.name, x: rect.x + rect.width / 2, y: rect.y + 70, fontSize: 16, color: '#ffffff', align: 'center', weight: 'bold' },
      { type: 'text', id: `seat-${player.id}-count`, text: `${player.hand.length} 张`, x: rect.x + rect.width / 2, y: rect.y + 96, fontSize: 12, color: '#dff7ff', align: 'center' }
    );
    if (active) {
      commands.push({ type: 'text', id: `seat-${player.id}-timer`, text: `思考 ${this.turnSecondsLeft()}s`, x: rect.x + rect.width / 2, y: rect.y + 114, fontSize: 11, color: '#fde68a', align: 'center', weight: 'bold' });
    }
  }

  pushHandCommands(commands, hitAreas, handRects, y) {
    const hand = this.me().hand;
    const panel = { x: 14, y: y - 14, width: this.width - 28, height: 132 };
    commands.push({ type: 'rect', id: 'hand-panel', rect: panel, fill: 'rgba(2,44,34,0.70)', radius: 18 });
    const cardW = Math.min(64, Math.floor((this.width - 54) / Math.min(hand.length || 1, 7)));
    const cardH = Math.round(cardW * 1.44);
    const gap = hand.length > 7 ? Math.round(cardW * 0.56) : Math.round(cardW * 0.78);
    const totalWidth = hand.length > 0 ? cardW + gap * (hand.length - 1) : 0;
    const start = hand.length > 7 ? panel.x + 18 : this.width / 2 - totalWidth / 2;
    const playableIds = new Set(this.playableCards().map((card) => card.id));
    hand.forEach((card, index) => {
      const selected = this.selectedCardId === card.id;
      const playable = playableIds.has(card.id) && this.currentPlayer().id === 'me';
      const lift = selected ? -36 : playable ? -16 : 0;
      const rect = { x: start + index * gap, y: y + lift, width: cardW, height: cardH };
      handRects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height, card });
      if (!this.drag || this.drag.cardId !== card.id) {
        commands.push({ type: 'image', id: `hand-card-${card.id}`, assetKey: this.cardAssetKey(card), rect, alpha: playable ? 1 : 0.55, rotation: (index - (hand.length - 1) / 2) * 0.045 });
        if (playable) {
          commands.push({ type: 'rect', id: `hand-card-${card.id}-glow`, rect: this.inflateRect(rect, 4), fill: 'rgba(250,204,21,0.10)', radius: 11, stroke: '#fde047', lineWidth: selected ? 3 : 2 });
        }
      }
      hitAreas.push({ id: `hit-card-${card.id}`, action: 'select_card', rect, payload: { cardId: card.id } });
    });
    if (this.drag) {
      const card = hand.find((item) => item.id === this.drag.cardId);
      if (card) {
        commands.push({ type: 'image', id: `drag-card-${card.id}`, assetKey: this.cardAssetKey(card), rect: { x: this.drag.x - cardW / 2, y: this.drag.y - cardH / 2, width: cardW, height: cardH } });
      }
    }
  }

  cardAssetKey(card) {
    if (card.type === 'wild') {
      return 'card.wild.color';
    }
    if (card.type === 'plus4') {
      return 'card.wild.plus4';
    }
    if (card.type === 'plus2') {
      return `card.${card.color}.plus2`;
    }
    if (card.type === 'reverse' || card.type === 'skip') {
      return `card.${card.color}.${card.type}`;
    }
    return `card.${card.color}.${card.label}`;
  }

  inflateRect(rect, amount) {
    return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
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
    this.text(`手牌 ${cards} 张`, x + 78, y + 48, 13, '#d9e8ff', '700');
    if (active) {
      const label = name === '我' ? `${this.turnSecondsLeft()}s` : `思考中 ${this.turnSecondsLeft()}s`;
      this.text(label, x + 78, y + 64, 12, '#ffe066', '900');
    }
  }

  sidePlayer(x, y, name, score, cards) {
    const active = this.game && this.currentPlayer().name === name;
    this.roundRect(x, y, 68, 128, 16, active ? 'rgba(27,116,235,0.96)' : 'rgba(16,70,154,0.86)', active ? '#ffe066' : '#5ea7ff', active ? 3 : 1.5);
    this.avatar(x + 8, y + 8, 52, 'avatar');
    this.text(name, x + 34, y + 76, 17, COLORS.white, '900', 'center');
    this.coinMini(x + 16, y + 88, score);
    this.text(`手牌 ${cards} 张`, x + 34, y + 118, 12, '#dce9ff', '700', 'center');
    if (active) {
      this.text(`思考 ${this.turnSecondsLeft()}s`, x + 34, y + 136, 11, '#ffe066', '900', 'center');
    }
    for (let i = 0; i < Math.min(cards, 5); i += 1) this.cardBack(x + 4, y + 142 + i * 22, 56, 78, 0);
  }

  turnSecondsLeft() {
    if (!this.game) {
      return 0;
    }
    const elapsed = Math.floor((Date.now() - this.game.turnStartedAt) / 1000);
    return Math.max(0, this.game.turnSeconds - elapsed);
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
