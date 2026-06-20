import type { LobbyViewModel } from '../lobby/LobbyView.js';
import type { HitArea, Rect, RenderCommand, RenderTree, RenderViewport } from './RenderCommand.js';

export class LobbyRenderer {
  render(model: LobbyViewModel, viewport: RenderViewport): RenderTree {
    const safeTop = viewport.safeTop ?? 0;
    const safeBottom = viewport.safeBottom ?? 0;
    const margin = Math.max(20, Math.round(viewport.width * 0.04));
    const commands: RenderCommand[] = [
      { type: 'rect', id: 'lobby-bg-color', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height }, fill: '#e9fbf4' },
      { type: 'image', id: 'lobby-bg', assetKey: 'background.lobby', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height }, alpha: 0.9 }
    ];
    const hitAreas: HitArea[] = [];
    const topBar = { x: margin, y: safeTop + 20, width: viewport.width - margin * 2, height: 86 };
    this.renderTopBar(model, topBar, commands, hitAreas);

    const logoY = topBar.y + topBar.height + 44;
    commands.push({ type: 'text', id: 'lobby-title', text: model.title, x: viewport.width / 2, y: logoY + 56, fontSize: 54, color: '#0f766e', align: 'center', weight: 'bold' });

    let cursorY = logoY + 112;
    if (model.resumeRoom) {
      const resumeRect = { x: margin, y: cursorY, width: viewport.width - margin * 2, height: 88 };
      commands.push({ type: 'rect', id: 'resume-room', rect: resumeRect, fill: '#fff7ed', radius: 16, stroke: '#fb923c', lineWidth: 2 });
      commands.push({ type: 'text', id: 'resume-room-title', text: model.resumeRoom.title, x: resumeRect.x + 24, y: resumeRect.y + 36, fontSize: 26, color: '#9a3412', align: 'left', weight: 'medium' });
      commands.push({ type: 'text', id: 'resume-room-subtitle', text: model.resumeRoom.subtitle, x: resumeRect.x + 24, y: resumeRect.y + 68, fontSize: 22, color: '#c2410c', align: 'left' });
      hitAreas.push({ id: 'hit-resume-room', action: model.resumeRoom.action, rect: resumeRect, payload: { roomId: model.resumeRoom.roomId } });
      cursorY += 112;
    }

    const buttonHeight = 104;
    model.primaryActions.forEach((action, index) => {
      const rect = { x: margin, y: cursorY + index * (buttonHeight + 18), width: viewport.width - margin * 2, height: buttonHeight };
      commands.push({ type: 'rect', id: `primary-${action.action}`, rect, fill: this.primaryFill(action.tone), radius: 18 });
      commands.push({ type: 'text', id: `primary-${action.action}-title`, text: action.title, x: rect.x + 34, y: rect.y + 42, fontSize: 30, color: '#ffffff', align: 'left', weight: 'bold' });
      commands.push({ type: 'text', id: `primary-${action.action}-subtitle`, text: action.subtitle, x: rect.x + 34, y: rect.y + 76, fontSize: 22, color: 'rgba(255,255,255,0.86)', align: 'left' });
      hitAreas.push({ id: `hit-primary-${action.action}`, action: action.action, rect });
    });
    cursorY += model.primaryActions.length * (buttonHeight + 18) + 20;

    const secondaryWidth = (viewport.width - margin * 2 - 18) / 2;
    model.secondaryCards.forEach((card, index) => {
      const rect = {
        x: margin + (index % 2) * (secondaryWidth + 18),
        y: cursorY + Math.floor(index / 2) * 116,
        width: secondaryWidth,
        height: 98
      };
      commands.push({ type: 'rect', id: `secondary-${card.action}`, rect, fill: 'rgba(255,255,255,0.86)', radius: 16, stroke: '#bae6fd', lineWidth: 1 });
      commands.push({ type: 'text', id: `secondary-${card.action}-title`, text: card.title, x: rect.x + 20, y: rect.y + 36, fontSize: 24, color: '#075985', align: 'left', weight: 'medium', maxWidth: rect.width - 40 });
      commands.push({ type: 'text', id: `secondary-${card.action}-subtitle`, text: card.subtitle, x: rect.x + 20, y: rect.y + 68, fontSize: 19, color: '#2563eb', align: 'left', maxWidth: rect.width - 40 });
      if (card.badge) {
        commands.push({ type: 'text', id: `secondary-${card.action}-badge`, text: card.badge, x: rect.x + rect.width - 18, y: rect.y + 28, fontSize: 18, color: '#dc2626', align: 'right' });
      }
      hitAreas.push({ id: `hit-secondary-${card.action}`, action: card.action, rect });
    });

    const tabHeight = 92;
    const tabTop = viewport.height - safeBottom - tabHeight;
    commands.push({ type: 'rect', id: 'bottom-tabs-bg', rect: { x: 0, y: tabTop, width: viewport.width, height: tabHeight + safeBottom }, fill: 'rgba(255,255,255,0.94)' });
    const tabWidth = viewport.width / model.bottomTabs.length;
    model.bottomTabs.forEach((item, index) => {
      const rect = { x: index * tabWidth, y: tabTop, width: tabWidth, height: tabHeight };
      commands.push({ type: 'text', id: `bottom-tab-${item.tab}`, text: item.tab, x: rect.x + rect.width / 2, y: rect.y + 54, fontSize: 22, color: item.active ? '#0f766e' : '#64748b', align: 'center', weight: item.active ? 'bold' : 'regular' });
      hitAreas.push({ id: `hit-bottom-tab-${item.tab}`, action: `tab_${item.tab}`, rect });
    });

    if (model.noviceTip) {
      commands.push({ type: 'text', id: 'novice-tip', text: model.noviceTip, x: viewport.width / 2, y: tabTop - 24, fontSize: 22, color: '#0f766e', align: 'center', maxWidth: viewport.width - margin * 2 });
    }

    return { width: viewport.width, height: viewport.height, commands, hitAreas };
  }

  private renderTopBar(model: LobbyViewModel, rect: Rect, commands: RenderCommand[], hitAreas: HitArea[]): void {
    commands.push({ type: 'rect', id: 'lobby-top-bar', rect, fill: 'rgba(255,255,255,0.88)', radius: 18, stroke: '#bae6fd', lineWidth: 1 });
    commands.push({ type: 'circle', id: 'lobby-avatar', x: rect.x + 42, y: rect.y + rect.height / 2, radius: 26, fill: '#38bdf8' });
    commands.push({ type: 'text', id: 'lobby-nickname', text: model.topBar.nickname, x: rect.x + 82, y: rect.y + 38, fontSize: 24, color: '#0f172a', align: 'left', weight: 'medium', maxWidth: rect.width - 250 });
    commands.push({ type: 'text', id: 'lobby-coin', text: `${model.topBar.coinText} 金币`, x: rect.x + 82, y: rect.y + 68, fontSize: 20, color: '#0f766e', align: 'left' });
    model.topBar.actions.forEach((action, index) => {
      const size = 54;
      const buttonRect = { x: rect.x + rect.width - (index + 1) * (size + 12), y: rect.y + 16, width: size, height: size };
      commands.push({ type: 'rect', id: `lobby-top-action-${action.action}`, rect: buttonRect, fill: '#e0f2fe', radius: 14 });
      commands.push({ type: 'text', id: `lobby-top-action-${action.action}-text`, text: action.title, x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + 36, fontSize: 18, color: '#075985', align: 'center' });
      hitAreas.push({ id: `hit-lobby-top-action-${action.action}`, action: action.action, rect: buttonRect });
    });
  }

  private primaryFill(tone: 'green' | 'blue' | 'teal'): string {
    if (tone === 'blue') {
      return '#2563eb';
    }
    if (tone === 'teal') {
      return '#0d9488';
    }
    return '#16a34a';
  }
}

