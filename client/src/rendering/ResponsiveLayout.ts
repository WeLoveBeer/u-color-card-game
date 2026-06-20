import type { Rect, RenderViewport } from './RenderCommand.js';

export type GameLayout = {
  viewport: Required<RenderViewport>;
  topBar: Rect;
  table: Rect;
  localPanel: Rect;
  hand: Rect;
  leftSeat: Rect;
  topSeat: Rect;
  rightSeat: Rect;
  discardPile: Rect;
  drawPile: Rect;
  directionRing: { x: number; y: number; radius: number };
  callUButton: Rect;
};

export class ResponsiveLayout {
  game(viewport: RenderViewport): GameLayout {
    const normalized: Required<RenderViewport> = {
      width: viewport.width,
      height: viewport.height,
      safeTop: viewport.safeTop ?? 0,
      safeBottom: viewport.safeBottom ?? 0
    };
    const unit = Math.min(normalized.width / 1080, normalized.height / 1920);
    const margin = Math.round(32 * unit);
    const top = normalized.safeTop + Math.round(24 * unit);
    const topBarHeight = Math.round(84 * unit);
    const handHeight = Math.round(310 * unit);
    const localPanelHeight = Math.round(104 * unit);
    const handTop = normalized.height - normalized.safeBottom - handHeight - margin;
    const localPanelTop = handTop - localPanelHeight - Math.round(18 * unit);
    const tableTop = top + topBarHeight + Math.round(20 * unit);
    const tableBottom = localPanelTop - Math.round(20 * unit);
    const table: Rect = {
      x: margin,
      y: tableTop,
      width: normalized.width - margin * 2,
      height: Math.max(Math.round(780 * unit), tableBottom - tableTop)
    };
    const centerX = table.x + table.width / 2;
    const centerY = table.y + table.height * 0.52;
    const cardWidth = Math.round(132 * unit);
    const cardHeight = Math.round(190 * unit);

    return {
      viewport: normalized,
      topBar: { x: margin, y: top, width: normalized.width - margin * 2, height: topBarHeight },
      table,
      localPanel: { x: margin, y: localPanelTop, width: normalized.width - margin * 2, height: localPanelHeight },
      hand: { x: margin, y: handTop, width: normalized.width - margin * 2, height: handHeight },
      leftSeat: { x: margin, y: table.y + table.height * 0.43, width: Math.round(190 * unit), height: Math.round(100 * unit) },
      topSeat: { x: centerX - Math.round(150 * unit), y: table.y + Math.round(24 * unit), width: Math.round(300 * unit), height: Math.round(92 * unit) },
      rightSeat: { x: normalized.width - margin - Math.round(190 * unit), y: table.y + table.height * 0.43, width: Math.round(190 * unit), height: Math.round(100 * unit) },
      discardPile: { x: centerX - cardWidth - Math.round(18 * unit), y: centerY - cardHeight / 2, width: cardWidth, height: cardHeight },
      drawPile: { x: centerX + Math.round(18 * unit), y: centerY - cardHeight / 2, width: cardWidth, height: cardHeight },
      directionRing: { x: centerX, y: centerY, radius: Math.round(210 * unit) },
      callUButton: {
        x: normalized.width - margin - Math.round(158 * unit),
        y: localPanelTop + Math.round(14 * unit),
        width: Math.round(158 * unit),
        height: Math.round(76 * unit)
      }
    };
  }
}

