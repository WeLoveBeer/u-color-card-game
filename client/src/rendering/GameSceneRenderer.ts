import type { CardViewModel } from '../game/views/CardView.js';
import type { GameSceneViewModel, PlayerSeatLayoutViewModel } from '../game/GameSceneController.js';
import { ResponsiveLayout } from './ResponsiveLayout.js';
import type { HitArea, Rect, RenderCommand, RenderTree, RenderViewport } from './RenderCommand.js';

const colorTone: Record<string, string> = {
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#38bdf8',
  green: '#22c55e'
};

export class GameSceneRenderer {
  constructor(private readonly layout = new ResponsiveLayout()) {}

  render(model: GameSceneViewModel, viewport: RenderViewport): RenderTree {
    const layout = this.layout.game(viewport);
    const commands: RenderCommand[] = [
      { type: 'rect', id: 'background', rect: { x: 0, y: 0, width: layout.viewport.width, height: layout.viewport.height }, fill: '#0f766e' },
      { type: 'image', id: 'table-bg', assetKey: 'background.table', rect: layout.table },
      { type: 'rect', id: 'top-bar', rect: layout.topBar, fill: 'rgba(8, 47, 73, 0.72)', radius: 16 },
      {
        type: 'text',
        id: 'prompt',
        text: model.prompt,
        x: layout.topBar.x + 24,
        y: layout.topBar.y + layout.topBar.height / 2 + 10,
        fontSize: 30,
        color: '#ffffff',
        align: 'left',
        maxWidth: layout.topBar.width - 260,
        weight: 'medium'
      }
    ];
    const hitAreas: HitArea[] = [];

    this.renderTopActions(model, layout.topBar, commands, hitAreas);
    this.renderSeats(model.seats, layout, commands);
    this.renderTable(model, layout, commands, hitAreas);
    this.renderLocalPanel(model, layout.localPanel, layout.callUButton, commands, hitAreas);
    this.renderHand(model.hand.cards, layout.hand, commands, hitAreas);
    this.renderColorPicker(model, layout.viewport.width, layout.viewport.height, commands, hitAreas);

    return { width: layout.viewport.width, height: layout.viewport.height, commands, hitAreas };
  }

  private renderTopActions(model: GameSceneViewModel, topBar: Rect, commands: RenderCommand[], hitAreas: HitArea[]): void {
    model.topActions.forEach((action, index) => {
      const size = 58;
      const gap = 18;
      const rect = { x: topBar.x + topBar.width - (index + 1) * size - index * gap, y: topBar.y + 13, width: size, height: size };
      commands.push({ type: 'rect', id: `top-action-${action.action}`, rect, fill: 'rgba(255,255,255,0.16)', radius: 14 });
      commands.push({
        type: 'text',
        id: `top-action-${action.action}-text`,
        text: action.title,
        x: rect.x + rect.width / 2,
        y: rect.y + 38,
        fontSize: 20,
        color: '#ffffff',
        align: 'center'
      });
      hitAreas.push({ id: `hit-top-action-${action.action}`, action: action.action, rect });
    });
  }

  private renderSeats(seats: PlayerSeatLayoutViewModel[], layout: ReturnType<ResponsiveLayout['game']>, commands: RenderCommand[]): void {
    const rectByPosition = {
      left: layout.leftSeat,
      top: layout.topSeat,
      right: layout.rightSeat,
      bottom: layout.localPanel
    };
    for (const seat of seats) {
      const rect = rectByPosition[seat.position];
      commands.push({ type: 'rect', id: `seat-${seat.playerId}`, rect, fill: seat.current ? 'rgba(250, 204, 21, 0.28)' : 'rgba(8, 47, 73, 0.68)', radius: 16, stroke: seat.current ? '#facc15' : '#7dd3fc', lineWidth: seat.current ? 3 : 1 });
      commands.push({ type: 'circle', id: `seat-${seat.playerId}-avatar`, x: rect.x + 34, y: rect.y + rect.height / 2, radius: 24, fill: seat.offline ? '#94a3b8' : '#38bdf8' });
      commands.push({ type: 'text', id: `seat-${seat.playerId}-name`, text: seat.nickname, x: rect.x + 70, y: rect.y + 38, fontSize: 22, color: '#ffffff', align: 'left', maxWidth: rect.width - 84, weight: 'medium' });
      commands.push({ type: 'text', id: `seat-${seat.playerId}-count`, text: `${seat.handCount} 张`, x: rect.x + 70, y: rect.y + 66, fontSize: 20, color: '#dff7ff', align: 'left' });
      if (seat.current) {
        const timerText = seat.thinking ? `思考中 ${seat.secondsLeft}s` : `${seat.secondsLeft}s`;
        commands.push({ type: 'text', id: `seat-${seat.playerId}-timer`, text: timerText, x: rect.x + 70, y: rect.y + 92, fontSize: 18, color: this.timerColor(seat.timerLevel), align: 'left' });
      }
      if (seat.badge) {
        commands.push({ type: 'text', id: `seat-${seat.playerId}-badge`, text: seat.badge, x: rect.x + rect.width - 12, y: rect.y + 28, fontSize: 18, color: '#fde68a', align: 'right' });
      }
    }
  }

  private renderTable(model: GameSceneViewModel, layout: ReturnType<ResponsiveLayout['game']>, commands: RenderCommand[], hitAreas: HitArea[]): void {
    const ring = layout.directionRing;
    const ringColor = model.table.directionRing ? colorTone[model.table.directionRing.color] : '#7dd3fc';
    commands.push({ type: 'arc', id: 'direction-ring', x: ring.x, y: ring.y, radius: ring.radius, startAngle: -0.5, endAngle: Math.PI * 1.8, stroke: ringColor, lineWidth: 12 });
    if (model.table.discard) {
      commands.push(this.cardImageCommand('discard-top', model.table.discard, layout.discardPile));
    }
    if (model.table.deck) {
      commands.push({ type: 'image', id: 'draw-pile', assetKey: 'card_back.default', rect: layout.drawPile, alpha: model.table.deck.highlighted ? 1 : 0.86 });
      if (model.table.deck.highlighted) {
        commands.push({ type: 'rect', id: 'draw-pile-glow', rect: this.inflate(layout.drawPile, 10), fill: 'rgba(250, 204, 21, 0.20)', radius: 16, stroke: '#facc15', lineWidth: 3 });
      }
      commands.push({ type: 'text', id: 'draw-count', text: String(model.table.deck.deckCount), x: layout.drawPile.x + layout.drawPile.width / 2, y: layout.drawPile.y + layout.drawPile.height + 30, fontSize: 24, color: '#e0f2fe', align: 'center' });
      hitAreas.push({ id: 'hit-draw-pile', action: 'draw_card', rect: layout.drawPile });
    }
    if (model.table.actionTip) {
      commands.push({ type: 'text', id: 'action-tip', text: model.table.actionTip, x: layout.table.x + layout.table.width / 2, y: layout.table.y + layout.table.height - 28, fontSize: 26, color: '#ffffff', align: 'center' });
    }
  }

  private renderLocalPanel(model: GameSceneViewModel, panel: Rect, callUButton: Rect, commands: RenderCommand[], hitAreas: HitArea[]): void {
    commands.push({ type: 'rect', id: 'local-panel', rect: panel, fill: model.localPlayer?.current ? 'rgba(14, 116, 144, 0.88)' : 'rgba(8, 47, 73, 0.78)', radius: 18, stroke: model.localPlayer?.current ? '#facc15' : '#7dd3fc', lineWidth: 2 });
    if (!model.localPlayer) {
      return;
    }
    commands.push({ type: 'text', id: 'local-hand-count', text: `我的手牌 ${model.localPlayer.handCount}`, x: panel.x + 28, y: panel.y + 42, fontSize: 26, color: '#ffffff', align: 'left', weight: 'medium' });
    commands.push({ type: 'text', id: 'local-timer', text: `${model.localPlayer.secondsLeft}s`, x: panel.x + 28, y: panel.y + 78, fontSize: 24, color: this.timerColor(model.localPlayer.timerLevel), align: 'left' });
    commands.push({ type: 'rect', id: 'call-u-button', rect: callUButton, fill: model.localPlayer.callU.enabled ? '#ef4444' : 'rgba(239, 68, 68, 0.42)', radius: 16 });
    commands.push({ type: 'text', id: 'call-u-text', text: model.localPlayer.callU.title, x: callUButton.x + callUButton.width / 2, y: callUButton.y + 48, fontSize: 28, color: '#ffffff', align: 'center', weight: 'bold' });
    hitAreas.push({ id: 'hit-call-u', action: 'call_u', rect: callUButton, payload: { enabled: model.localPlayer.callU.enabled } });
  }

  private renderHand(cards: CardViewModel[], hand: Rect, commands: RenderCommand[], hitAreas: HitArea[]): void {
    commands.push({ type: 'rect', id: 'hand-panel', rect: hand, fill: 'rgba(2, 44, 34, 0.70)', radius: 20 });
    const cardWidth = Math.min(128, Math.floor(hand.width / Math.min(cards.length || 1, 7)));
    const cardHeight = Math.round(cardWidth * 1.44);
    const step = cards.length > 7 ? Math.round(cardWidth * 0.56) : Math.round(cardWidth * 0.78);
    const totalWidth = cards.length > 0 ? cardWidth + step * (cards.length - 1) : 0;
    const startX = cards.length > 7 ? hand.x + 24 : hand.x + (hand.width - totalWidth) / 2;
    cards.forEach((card, index) => {
      const yOffset = card.selected ? -34 : card.playable ? -16 : 0;
      const rect = { x: startX + step * index, y: hand.y + 74 + yOffset, width: cardWidth, height: cardHeight };
      commands.push(this.cardImageCommand(`hand-card-${card.id}`, card, rect, card.playable ? 1 : 0.55));
      if (card.playable) {
        commands.push({ type: 'rect', id: `hand-card-${card.id}-playable`, rect: this.inflate(rect, 5), fill: 'rgba(250, 204, 21, 0.12)', radius: 12, stroke: '#fde047', lineWidth: card.selected ? 3 : 2 });
      }
      hitAreas.push({ id: `hit-hand-card-${card.id}`, action: 'select_card', rect, payload: { cardId: card.id, playable: card.playable } });
    });
  }

  private renderColorPicker(model: GameSceneViewModel, width: number, height: number, commands: RenderCommand[], hitAreas: HitArea[]): void {
    const colorPicker = model.colorPicker;
    if (!colorPicker) {
      return;
    }
    const centerX = width / 2;
    const centerY = height / 2;
    commands.push({ type: 'rect', id: 'color-picker-mask', rect: { x: 0, y: 0, width, height }, fill: 'rgba(0, 0, 0, 0.48)' });
    commands.push({ type: 'text', id: 'color-picker-title', text: colorPicker.title, x: centerX, y: centerY - 150, fontSize: 32, color: '#ffffff', align: 'center', weight: 'bold' });
    colorPicker.colors.forEach((item, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI / 2);
      const rect = { x: centerX + Math.cos(angle) * 100 - 48, y: centerY + Math.sin(angle) * 100 - 48, width: 96, height: 96 };
      commands.push({ type: 'circle', id: `color-picker-${item.color}`, x: rect.x + 48, y: rect.y + 48, radius: item.recommended ? 54 : 46, fill: colorTone[item.color], stroke: item.recommended ? '#ffffff' : undefined, lineWidth: item.recommended ? 4 : undefined });
      hitAreas.push({ id: `hit-color-${item.color}`, action: 'choose_color', rect, payload: { color: item.color, cardId: colorPicker.cardId } });
    });
  }

  private cardImageCommand(id: string, card: CardViewModel, rect: Rect, alpha = 1): RenderCommand {
    return { type: 'image', id, assetKey: card.assetKey, rect, alpha };
  }

  private inflate(rect: Rect, amount: number): Rect {
    return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
  }

  private timerColor(level: 'normal' | 'warning' | 'danger'): string {
    if (level === 'danger') {
      return '#fca5a5';
    }
    if (level === 'warning') {
      return '#fde68a';
    }
    return '#dff7ff';
  }
}
