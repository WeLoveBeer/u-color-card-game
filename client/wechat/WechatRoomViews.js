export const DEFAULT_RULE_CONFIG = {
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

const COLOR_TONE = {
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#38bdf8',
  green: '#22c55e',
  wild: '#20232a'
};

export function viewport(runtime) {
  return { width: runtime.width, height: runtime.height, safeTop: 0, safeBottom: 0 };
}

export function renderCreateRoom(config, vp) {
  const margin = Math.max(18, Math.round(vp.width * 0.045));
  const commands = [
    { type: 'rect', id: 'create-bg', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, fill: '#eff6ff' }
  ];
  const hitAreas = [];
  commands.push(
    { type: 'rect', id: 'create-top', rect: { x: margin, y: 20, width: vp.width - margin * 2, height: 76 }, fill: '#ffffff', radius: 16, stroke: '#bfdbfe', lineWidth: 1 },
    { type: 'text', id: 'create-title', text: '创建房间', x: margin + 24, y: 66, fontSize: 30, color: '#0f172a', align: 'left', weight: 'bold' },
    { type: 'text', id: 'create-back', text: '返回', x: vp.width - margin - 34, y: 64, fontSize: 19, color: '#2563eb', align: 'center', weight: 'medium' }
  );
  hitAreas.push({ id: 'hit-back', action: 'lobby', rect: { x: vp.width - margin - 78, y: 28, width: 76, height: 56 } });

  const rows = [
    { key: 'playerCount', title: '人数', options: [['2', 2, '2人'], ['3', 3, '3人'], ['4', 4, '4人']] },
    { key: 'initialCards', title: '初始手牌', options: [['5', 5, '5张'], ['7', 7, '7张'], ['9', 9, '9张']] },
    { key: 'turnSeconds', title: '倒计时', options: [['15', 15, '15秒'], ['30', 30, '30秒'], ['60', 60, '60秒']] },
    { key: 'ruleSet', title: '规则', options: [['standard', 'standard', '标准'], ['party', 'party', '欢乐']] },
    { key: 'rounds', title: '局数', options: [['1', 1, '1局'], ['3', 3, '3局'], ['5', 5, '5局']] }
  ];
  let y = 126;
  for (const row of rows) {
    commands.push({ type: 'text', id: `label-${row.key}`, text: row.title, x: margin, y: y + 28, fontSize: 21, color: '#0f172a', align: 'left', weight: 'medium' });
    const optionW = (vp.width - margin * 2 - 86 - 16) / row.options.length;
    row.options.forEach(([optionKey, value, label], index) => {
      const selected = config[row.key] === value;
      const rect = { x: margin + 86 + index * (optionW + 8), y, width: optionW, height: 44 };
      commands.push({ type: 'rect', id: `option-${row.key}-${optionKey}`, rect, fill: selected ? '#2563eb' : '#ffffff', radius: 12, stroke: selected ? '#2563eb' : '#bfdbfe', lineWidth: 1 });
      commands.push({ type: 'text', id: `option-${row.key}-${optionKey}-text`, text: label, x: rect.x + rect.width / 2, y: rect.y + 29, fontSize: 18, color: selected ? '#ffffff' : '#1d4ed8', align: 'center', weight: 'medium' });
      hitAreas.push({ id: `hit-option-${row.key}-${optionKey}`, action: 'set_room_config', rect, payload: { key: row.key, value } });
    });
    y += 64;
  }

  const toggles = [
    ['plusTwoStack', '加二叠加'],
    ['plusFourChallenge', '+4 质疑'],
    ['callUPenalty', '忘喊 U'],
    ['aiFill', 'AI 补位']
  ];
  toggles.forEach(([key, title], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const rect = { x: margin + col * ((vp.width - margin * 2 + 12) / 2), y: y + row * 58, width: (vp.width - margin * 2 - 12) / 2, height: 44 };
    const enabled = Boolean(config[key]);
    commands.push({ type: 'rect', id: `toggle-${key}`, rect, fill: enabled ? '#dcfce7' : '#ffffff', radius: 12, stroke: enabled ? '#22c55e' : '#bfdbfe', lineWidth: 1 });
    commands.push({ type: 'text', id: `toggle-${key}-text`, text: `${title}: ${enabled ? '开' : '关'}`, x: rect.x + rect.width / 2, y: rect.y + 29, fontSize: 17, color: enabled ? '#166534' : '#1d4ed8', align: 'center', weight: 'medium' });
    hitAreas.push({ id: `hit-toggle-${key}`, action: 'toggle_room_config', rect, payload: { key } });
  });

  const primary = { x: margin, y: vp.height - 108, width: vp.width - margin * 2, height: 72 };
  commands.push(
    { type: 'rect', id: 'create-primary', rect: primary, fill: '#16a34a', radius: 18 },
    { type: 'text', id: 'create-primary-text', text: '创建房间', x: primary.x + primary.width / 2, y: primary.y + 46, fontSize: 28, color: '#ffffff', align: 'center', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-create-room-submit', action: 'create_room_submit', rect: primary });
  return { width: vp.width, height: vp.height, commands, hitAreas };
}

export function renderJoinRoom(input, recentRooms, vp) {
  const margin = Math.max(18, Math.round(vp.width * 0.045));
  const normalized = String(input || '').trim().toUpperCase();
  const valid = /^[A-Z0-9]{4,12}$/.test(normalized);
  const commands = [
    { type: 'rect', id: 'join-bg', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, fill: '#f0fdfa' },
    { type: 'rect', id: 'join-top', rect: { x: margin, y: 20, width: vp.width - margin * 2, height: 76 }, fill: '#ffffff', radius: 16, stroke: '#99f6e4', lineWidth: 1 },
    { type: 'text', id: 'join-title', text: '加入房间', x: margin + 24, y: 66, fontSize: 30, color: '#0f172a', align: 'left', weight: 'bold' },
    { type: 'text', id: 'join-back', text: '返回', x: vp.width - margin - 34, y: 64, fontSize: 19, color: '#0d9488', align: 'center', weight: 'medium' }
  ];
  const hitAreas = [{ id: 'hit-back', action: 'lobby', rect: { x: vp.width - margin - 78, y: 28, width: 76, height: 56 } }];
  const box = { x: margin, y: 134, width: vp.width - margin * 2, height: 86 };
  commands.push(
    { type: 'rect', id: 'join-input', rect: box, fill: '#ffffff', radius: 16, stroke: valid || normalized.length === 0 ? '#5eead4' : '#ef4444', lineWidth: 2 },
    { type: 'text', id: 'join-input-text', text: normalized || '输入房号', x: box.x + 24, y: box.y + 54, fontSize: 32, color: normalized ? '#0f172a' : '#94a3b8', align: 'left', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-room-input', action: 'edit_room_id', rect: box });
  if (normalized.length > 0 && !valid) {
    commands.push({ type: 'text', id: 'join-error', text: '房号格式不正确', x: margin, y: box.y + box.height + 28, fontSize: 18, color: '#ef4444', align: 'left' });
  }
  const primary = { x: margin, y: box.y + 126, width: vp.width - margin * 2, height: 70 };
  commands.push(
    { type: 'rect', id: 'join-primary', rect: primary, fill: valid ? '#0d9488' : '#94a3b8', radius: 18 },
    { type: 'text', id: 'join-primary-text', text: '加入房间', x: primary.x + primary.width / 2, y: primary.y + 45, fontSize: 28, color: '#ffffff', align: 'center', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-join-room-submit', action: 'join_room_submit', rect: primary, payload: { disabled: !valid } });
  commands.push({ type: 'text', id: 'recent-title', text: '最近房间', x: margin, y: primary.y + 118, fontSize: 23, color: '#0f172a', align: 'left', weight: 'medium' });
  if (!recentRooms.length) {
    commands.push({ type: 'text', id: 'recent-empty', text: '还没有最近房间，可以输入好友分享的房间号', x: margin, y: primary.y + 158, fontSize: 18, color: '#64748b', align: 'left', maxWidth: vp.width - margin * 2 });
  }
  recentRooms.slice(0, 4).forEach((room, index) => {
    const rect = { x: margin, y: primary.y + 142 + index * 58, width: vp.width - margin * 2, height: 46 };
    commands.push({ type: 'rect', id: `recent-${room.roomId}`, rect, fill: '#ffffff', radius: 12, stroke: '#99f6e4', lineWidth: 1 });
    commands.push({ type: 'text', id: `recent-${room.roomId}-text`, text: `${room.roomId} · ${room.statusText || '等待中'}`, x: rect.x + 18, y: rect.y + 30, fontSize: 19, color: '#0f766e', align: 'left', weight: 'medium' });
    hitAreas.push({ id: `hit-recent-${room.roomId}`, action: 'rejoin_room', rect, payload: { roomId: room.roomId } });
  });
  return { width: vp.width, height: vp.height, commands, hitAreas };
}

export function renderRoom(room, viewerId, vp) {
  const margin = Math.max(18, Math.round(vp.width * 0.045));
  const commands = [
    { type: 'rect', id: 'room-bg', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, fill: '#eff6ff' }
  ];
  const hitAreas = [];
  const topBar = { x: margin, y: 20, width: vp.width - margin * 2, height: 96 };
  commands.push(
    { type: 'rect', id: 'room-top-bar', rect: topBar, fill: '#ffffff', radius: 18, stroke: '#bfdbfe', lineWidth: 1 },
    { type: 'text', id: 'room-title', text: `房间 ${room.roomId}`, x: topBar.x + 24, y: topBar.y + 40, fontSize: 28, color: '#0f172a', align: 'left', weight: 'bold' },
    { type: 'text', id: 'room-summary', text: roomSummary(room.config), x: topBar.x + 24, y: topBar.y + 74, fontSize: 19, color: '#2563eb', align: 'left', maxWidth: topBar.width - 48 }
  );
  [
    ['copy_room_id', '复制'],
    ['share_room', '分享'],
    ['leave_room', '退出']
  ].forEach(([action, label], index) => {
    const rect = { x: topBar.x + topBar.width - (index + 1) * 60, y: topBar.y + 20, width: 50, height: 50 };
    commands.push({ type: 'rect', id: `room-${action}`, rect, fill: '#dbeafe', radius: 13 });
    commands.push({ type: 'text', id: `room-${action}-text`, text: label, x: rect.x + rect.width / 2, y: rect.y + 32, fontSize: 16, color: '#1d4ed8', align: 'center', weight: 'medium' });
    hitAreas.push({ id: `hit-room-${action}`, action, rect });
  });

  const seats = buildRoomSeats(room);
  const seatAreaTop = topBar.y + topBar.height + 38;
  const seatGap = 18;
  const seatWidth = (vp.width - margin * 2 - seatGap) / 2;
  const seatHeight = 138;
  seats.forEach((seat, index) => {
    const rect = { x: margin + (index % 2) * (seatWidth + seatGap), y: seatAreaTop + Math.floor(index / 2) * (seatHeight + seatGap), width: seatWidth, height: seatHeight };
    const fill = seat.empty ? '#ffffff' : seat.online ? '#e0f2fe' : '#e2e8f0';
    const stroke = seat.owner ? '#facc15' : seat.ready ? '#22c55e' : '#bfdbfe';
    commands.push({ type: 'rect', id: `room-seat-${seat.seatIndex}`, rect, fill, radius: 18, stroke, lineWidth: seat.owner || seat.ready ? 3 : 1 });
    commands.push({ type: 'circle', id: `room-seat-${seat.seatIndex}-avatar`, x: rect.x + 42, y: rect.y + 50, radius: 26, fill: seat.empty ? '#cbd5e1' : seat.isAi ? '#22c55e' : '#38bdf8' });
    commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-label`, text: seat.label, x: rect.x + 78, y: rect.y + 48, fontSize: 20, color: '#0f172a', align: 'left', weight: 'medium', maxWidth: rect.width - 92 });
    commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-status`, text: seat.empty ? '等待加入' : seat.online ? '在线' : '离线', x: rect.x + 78, y: rect.y + 78, fontSize: 17, color: seat.online ? '#0f766e' : '#64748b', align: 'left' });
    if (seat.badge) {
      commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-badge`, text: seat.badge, x: rect.x + rect.width - 14, y: rect.y + rect.height - 18, fontSize: 17, color: seat.ready ? '#16a34a' : '#1d4ed8', align: 'right' });
    }
    if (seat.empty) {
      hitAreas.push({ id: `hit-room-seat-${seat.seatIndex}`, action: 'invite_to_seat', rect, payload: { seatIndex: seat.seatIndex } });
    }
  });

  const quickTop = seatAreaTop + Math.ceil(seats.length / 2) * (seatHeight + seatGap) + 20;
  ['我准备好了', '快开始吧', '这把真随机', '手气来了'].forEach((message, index) => {
    const rect = { x: margin + (index % 2) * (seatWidth + seatGap), y: quickTop + Math.floor(index / 2) * 54, width: seatWidth, height: 40 };
    commands.push({ type: 'rect', id: `quick-${index}`, rect, fill: '#ffffff', radius: 12, stroke: '#bfdbfe', lineWidth: 1 });
    commands.push({ type: 'text', id: `quick-${index}-text`, text: message, x: rect.x + rect.width / 2, y: rect.y + 26, fontSize: 17, color: '#1d4ed8', align: 'center' });
    hitAreas.push({ id: `hit-quick-${index}`, action: 'send_quick_message', rect, payload: { message } });
  });

  const primary = primaryRoomButton(room, viewerId);
  const primaryRect = { x: margin, y: vp.height - 108, width: vp.width - margin * 2, height: 72 };
  commands.push({ type: 'rect', id: 'room-primary', rect: primaryRect, fill: primary.disabled ? '#94a3b8' : '#16a34a', radius: 18 });
  commands.push({ type: 'text', id: 'room-primary-text', text: primary.title, x: primaryRect.x + primaryRect.width / 2, y: primaryRect.y + 45, fontSize: 28, color: '#ffffff', align: 'center', weight: 'bold' });
  if (primary.reason) {
    commands.push({ type: 'text', id: 'room-primary-reason', text: primary.reason, x: primaryRect.x + primaryRect.width / 2, y: primaryRect.y - 16, fontSize: 18, color: '#64748b', align: 'center' });
  }
  hitAreas.push({ id: 'hit-room-primary', action: primary.action, rect: primaryRect, payload: { disabled: primary.disabled } });
  return { width: vp.width, height: vp.height, commands, hitAreas };
}

export function renderServerGame(state, viewerId, selectedCardId, pendingColorCardId, vp) {
  const margin = Math.max(16, Math.round(vp.width * 0.04));
  const commands = [
    { type: 'rect', id: 'server-game-bg', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, fill: '#071538' },
    { type: 'image', id: 'table-bg', assetKey: 'background.table', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, alpha: 0.9 }
  ];
  const hitAreas = [];
  const isMyTurn = state.currentPlayerId === viewerId;
  const playableIds = new Set((state.myHand || []).filter((card) => canPlayVisibleCard(state, card)).map((card) => card.id));
  const prompt = isMyTurn ? (playableIds.size ? '轮到你出牌' : '没有可出牌，点击牌堆摸牌') : '等待对手出牌';
  const topBar = { x: margin, y: 18, width: vp.width - margin * 2, height: 58 };
  commands.push(
    { type: 'rect', id: 'game-top-bar', rect: topBar, fill: 'rgba(8,47,73,0.72)', radius: 14 },
    { type: 'text', id: 'game-prompt', text: prompt, x: margin + 18, y: 55, fontSize: 20, color: '#ffffff', align: 'left', weight: 'medium', maxWidth: topBar.width - 150 },
    { type: 'text', id: 'game-rules', text: '规则', x: vp.width - margin - 92, y: 54, fontSize: 17, color: '#ffffff', align: 'center' },
    { type: 'text', id: 'game-settings', text: '设置', x: vp.width - margin - 36, y: 54, fontSize: 17, color: '#ffffff', align: 'center' }
  );
  hitAreas.push({ id: 'hit-rules', action: 'rules', rect: { x: vp.width - margin - 120, y: 24, width: 54, height: 44 } });
  hitAreas.push({ id: 'hit-settings', action: 'settings', rect: { x: vp.width - margin - 64, y: 24, width: 54, height: 44 } });
  renderServerSeats(commands, state, viewerId, vp);

  const centerX = vp.width / 2;
  const centerY = vp.height * 0.43;
  const ringRadius = Math.min(vp.width * 0.27, 116);
  const ringColor = COLOR_TONE[state.currentColor] || '#7dd3fc';
  commands.push({ type: 'arc', id: 'direction-ring', x: centerX, y: centerY, radius: ringRadius, startAngle: state.direction === -1 ? Math.PI * 0.82 : -0.2, endAngle: state.direction === -1 ? Math.PI * 2.2 : Math.PI * 1.18, stroke: ringColor, lineWidth: 10 });
  const cardW = Math.min(86, vp.width * 0.22);
  const cardH = Math.round(cardW * 1.42);
  const drawPile = { x: centerX - cardW - 22, y: centerY - cardH / 2, width: cardW, height: cardH };
  const discardPile = { x: centerX + 22, y: centerY - cardH / 2, width: cardW, height: cardH };
  commands.push(
    { type: 'image', id: 'draw-pile', assetKey: 'card_back.default', rect: drawPile, alpha: isMyTurn && playableIds.size === 0 ? 1 : 0.86 },
    { type: 'image', id: 'discard-pile', assetKey: assetKeyForCard(state.discardTop), rect: discardPile },
    { type: 'text', id: 'deck-count', text: String(state.deckCount), x: drawPile.x + drawPile.width / 2, y: drawPile.y + drawPile.height + 24, fontSize: 18, color: '#e0f2fe', align: 'center', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-draw-pile', action: 'server_draw_card', rect: drawPile });
  const localPanel = { x: margin, y: vp.height * 0.64, width: vp.width - margin * 2, height: 68 };
  const me = state.players.find((player) => player.id === viewerId);
  commands.push(
    { type: 'rect', id: 'local-panel', rect: localPanel, fill: isMyTurn ? 'rgba(14,116,144,0.88)' : 'rgba(8,47,73,0.78)', radius: 17, stroke: isMyTurn ? '#facc15' : '#7dd3fc', lineWidth: 2 },
    { type: 'text', id: 'local-title', text: `我 · 手牌 ${(state.myHand || []).length} 张`, x: localPanel.x + 20, y: localPanel.y + 29, fontSize: 20, color: '#ffffff', align: 'left', weight: 'bold' },
    { type: 'text', id: 'local-timer', text: `${secondsLeft(state)}s`, x: localPanel.x + 20, y: localPanel.y + 54, fontSize: 18, color: secondsLeft(state) <= 5 ? '#fca5a5' : '#dff7ff', align: 'left', weight: 'medium' },
    { type: 'rect', id: 'call-u-button', rect: { x: localPanel.x + localPanel.width - 102, y: localPanel.y + 12, width: 88, height: 44 }, fill: isMyTurn && (state.myHand || []).length === 2 ? '#ef4444' : 'rgba(239,68,68,0.42)', radius: 14 },
    { type: 'text', id: 'call-u-text', text: '喊 U', x: localPanel.x + localPanel.width - 58, y: localPanel.y + 41, fontSize: 22, color: '#ffffff', align: 'center', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-call-u', action: 'server_call_u', rect: { x: localPanel.x + localPanel.width - 102, y: localPanel.y + 12, width: 88, height: 44 } });
  renderServerHand(commands, hitAreas, state.myHand || [], playableIds, selectedCardId, vp);
  if (pendingColorCardId) {
    renderColorPicker(commands, hitAreas, state.myHand || [], pendingColorCardId, vp);
  }
  if (state.status === 'finished') {
    renderResultOverlay(commands, hitAreas, vp, '本局结束');
  }
  return { width: vp.width, height: vp.height, commands, hitAreas };
}

export function roomSummary(config) {
  return `${config.playerCount}人 · ${config.initialCards}张起手 · ${config.turnSeconds}秒 · ${config.ruleSet === 'party' ? '欢乐规则' : '标准规则'}`;
}

export function assetKeyForCard(card) {
  if (!card) {
    return 'card_back.default';
  }
  if (card.type === 'wild_color' || card.type === 'wild') {
    return 'card.wild.color';
  }
  if (card.type === 'wild_plus_four' || card.type === 'plus4') {
    return 'card.wild.plus4';
  }
  if (card.type === 'plus_two' || card.type === 'plus2') {
    return `card.${card.color}.plus2`;
  }
  if (card.type === 'reverse' || card.type === 'skip') {
    return `card.${card.color}.${card.type}`;
  }
  return `card.${card.color}.${card.value ?? card.label}`;
}

function buildRoomSeats(room) {
  const bySeat = new Map((room.players || []).map((player) => [player.seatIndex, player]));
  return Array.from({ length: room.config.playerCount }, (_, seatIndex) => {
    const player = bySeat.get(seatIndex);
    if (!player) {
      return { id: null, seatIndex, label: '邀请好友', ready: false, online: false, isAi: false, empty: true, owner: false, badge: '空位' };
    }
    return {
      id: player.id,
      seatIndex,
      label: player.isAi ? 'AI 对手' : player.nickname || player.id,
      ready: Boolean(player.ready),
      online: player.online,
      isAi: player.isAi,
      empty: false,
      owner: player.id === room.ownerId,
      badge: player.isAutoPlaying ? '托管' : !player.online ? '离线' : player.id === room.ownerId ? '房主' : player.ready ? '已准备' : '未准备'
    };
  });
}

function primaryRoomButton(room, viewerId) {
  if (room.ownerId !== viewerId) {
    const viewer = room.players.find((player) => player.id === viewerId);
    return { action: viewer?.ready ? 'cancel_ready' : 'ready', title: viewer?.ready ? '取消准备' : '准备', disabled: room.status !== 'waiting', reason: room.status === 'waiting' ? null : '房间已开始' };
  }
  if (room.players.length < room.config.playerCount && room.config.aiFill) {
    return { action: 'start_game', title: '开始并补 AI', disabled: false, reason: null };
  }
  if (room.players.length < room.config.playerCount) {
    return { action: 'start_game', title: '等待玩家加入', disabled: true, reason: '人数不足' };
  }
  if (room.players.some((player) => player.id !== room.ownerId && !player.isAi && !player.ready)) {
    return { action: 'start_game', title: '等待准备', disabled: true, reason: '仍有玩家未准备' };
  }
  return { action: 'start_game', title: '开始游戏', disabled: room.status !== 'waiting', reason: room.status === 'waiting' ? null : '房间已开始' };
}

function canPlayVisibleCard(state, card) {
  if (state.pendingDrawCount > 0) {
    return card.type === 'plus_two' || card.type === 'wild_plus_four';
  }
  return card.color === state.currentColor ||
    (card.type === 'number' && card.value === state.discardTop?.value) ||
    (card.type !== 'number' && card.type === state.discardTop?.type) ||
    card.type === 'wild_color' ||
    card.type === 'wild_plus_four';
}

function renderServerSeats(commands, state, viewerId, vp) {
  const others = [...(state.players || [])].filter((player) => player.id !== viewerId).sort((a, b) => a.seatIndex - b.seatIndex);
  const positions = others.length === 1
    ? [{ x: vp.width / 2 - 92, y: 92, width: 184, height: 62 }]
    : others.length === 2
      ? [{ x: 8, y: vp.height * 0.29, width: 76, height: 118 }, { x: vp.width - 84, y: vp.height * 0.29, width: 76, height: 118 }]
      : [{ x: 8, y: vp.height * 0.29, width: 76, height: 118 }, { x: vp.width / 2 - 92, y: 92, width: 184, height: 62 }, { x: vp.width - 84, y: vp.height * 0.29, width: 76, height: 118 }];
  others.forEach((player, index) => {
    const rect = positions[index];
    const active = state.currentPlayerId === player.id;
    commands.push({ type: 'rect', id: `seat-${player.id}`, rect, fill: active ? 'rgba(250,204,21,0.26)' : 'rgba(8,47,73,0.68)', radius: 16, stroke: active ? '#facc15' : '#7dd3fc', lineWidth: active ? 3 : 1 });
    commands.push({ type: 'circle', id: `seat-${player.id}-avatar`, x: rect.x + rect.width / 2, y: rect.y + 28, radius: 24, fill: player.online ? '#38bdf8' : '#94a3b8' });
    commands.push({ type: 'text', id: `seat-${player.id}-name`, text: player.isAi ? `AI ${index + 1}` : `玩家 ${player.seatIndex + 1}`, x: rect.x + rect.width / 2, y: rect.y + 70, fontSize: 15, color: '#ffffff', align: 'center', weight: 'bold' });
    commands.push({ type: 'text', id: `seat-${player.id}-count`, text: `${player.handCount} 张`, x: rect.x + rect.width / 2, y: rect.y + 96, fontSize: 12, color: '#dff7ff', align: 'center' });
  });
}

function renderServerHand(commands, hitAreas, hand, playableIds, selectedCardId, vp) {
  const panel = { x: 14, y: vp.height - 140, width: vp.width - 28, height: 132 };
  commands.push({ type: 'rect', id: 'hand-panel', rect: panel, fill: 'rgba(2,44,34,0.70)', radius: 18 });
  const cardW = Math.min(64, Math.floor((vp.width - 54) / Math.min(hand.length || 1, 7)));
  const cardH = Math.round(cardW * 1.44);
  const gap = hand.length > 7 ? Math.round(cardW * 0.56) : Math.round(cardW * 0.78);
  const totalWidth = hand.length > 0 ? cardW + gap * (hand.length - 1) : 0;
  const start = hand.length > 7 ? panel.x + 18 : vp.width / 2 - totalWidth / 2;
  hand.forEach((card, index) => {
    const selected = selectedCardId === card.id;
    const playable = playableIds.has(card.id);
    const rect = { x: start + index * gap, y: panel.y + 20 + (selected ? -34 : playable ? -16 : 0), width: cardW, height: cardH };
    commands.push({ type: 'image', id: `hand-card-${card.id}`, assetKey: assetKeyForCard(card), rect, alpha: playable ? 1 : 0.55 });
    if (playable) {
      commands.push({ type: 'rect', id: `hand-card-${card.id}-glow`, rect: { x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 }, fill: 'rgba(250,204,21,0.10)', radius: 11, stroke: '#fde047', lineWidth: selected ? 3 : 2 });
    }
    hitAreas.push({ id: `hit-card-${card.id}`, action: 'server_select_card', rect, payload: { cardId: card.id, playable } });
  });
}

function renderColorPicker(commands, hitAreas, hand, cardId, vp) {
  const centerX = vp.width / 2;
  const centerY = vp.height / 2;
  const recommended = recommendColor(hand.filter((card) => card.id !== cardId));
  commands.push({ type: 'rect', id: 'color-mask', rect: { x: 0, y: 0, width: vp.width, height: vp.height }, fill: 'rgba(0,0,0,0.50)' });
  commands.push({ type: 'text', id: 'color-title', text: '选择颜色', x: centerX, y: centerY - 148, fontSize: 32, color: '#ffffff', align: 'center', weight: 'bold' });
  ['red', 'yellow', 'blue', 'green'].forEach((color, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const rect = { x: centerX + Math.cos(angle) * 100 - 48, y: centerY + Math.sin(angle) * 100 - 48, width: 96, height: 96 };
    commands.push({ type: 'circle', id: `color-${color}`, x: rect.x + 48, y: rect.y + 48, radius: recommended === color ? 54 : 46, fill: COLOR_TONE[color], stroke: recommended === color ? '#ffffff' : undefined, lineWidth: recommended === color ? 4 : undefined });
    hitAreas.push({ id: `hit-color-${color}`, action: 'server_choose_color', rect, payload: { color, cardId } });
  });
}

function renderResultOverlay(commands, hitAreas, vp, message) {
  const overlay = { x: 32, y: vp.height * 0.34, width: vp.width - 64, height: 150 };
  commands.push(
    { type: 'rect', id: 'result-overlay', rect: overlay, fill: 'rgba(5,23,50,0.92)', radius: 18, stroke: '#7bb7ff', lineWidth: 2 },
    { type: 'text', id: 'result-message', text: message, x: vp.width / 2, y: overlay.y + 60, fontSize: 26, color: '#ffffff', align: 'center', weight: 'bold', maxWidth: overlay.width - 32 },
    { type: 'rect', id: 'back-room-button', rect: { x: vp.width / 2 - 84, y: overlay.y + 88, width: 168, height: 44 }, fill: '#16a34a', radius: 12 },
    { type: 'text', id: 'back-room-text', text: '返回房间', x: vp.width / 2, y: overlay.y + 117, fontSize: 21, color: '#ffffff', align: 'center', weight: 'bold' }
  );
  hitAreas.push({ id: 'hit-back-room', action: 'room', rect: { x: vp.width / 2 - 84, y: overlay.y + 88, width: 168, height: 44 } });
}

function secondsLeft(state) {
  return Math.max(0, Math.ceil(((state.turnDeadline || Date.now()) - Date.now()) / 1000));
}

function recommendColor(hand) {
  const counts = { red: 0, yellow: 0, blue: 0, green: 0 };
  for (const card of hand) {
    if (counts[card.color] !== undefined) {
      counts[card.color] += 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red';
}
