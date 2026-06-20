import type { RoomViewModel } from '../room/RoomView.js';
import type { HitArea, Rect, RenderCommand, RenderTree, RenderViewport } from './RenderCommand.js';

export class RoomRenderer {
  render(model: RoomViewModel, viewport: RenderViewport): RenderTree {
    const safeTop = viewport.safeTop ?? 0;
    const safeBottom = viewport.safeBottom ?? 0;
    const margin = Math.max(20, Math.round(viewport.width * 0.04));
    const commands: RenderCommand[] = [
      { type: 'rect', id: 'room-bg', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height }, fill: '#eff6ff' }
    ];
    const hitAreas: HitArea[] = [];
    const topBar = { x: margin, y: safeTop + 20, width: viewport.width - margin * 2, height: 96 };
    commands.push({ type: 'rect', id: 'room-top-bar', rect: topBar, fill: '#ffffff', radius: 18, stroke: '#bfdbfe', lineWidth: 1 });
    commands.push({ type: 'text', id: 'room-title', text: `房间 ${model.roomId}`, x: topBar.x + 24, y: topBar.y + 40, fontSize: 28, color: '#0f172a', align: 'left', weight: 'bold' });
    commands.push({ type: 'text', id: 'room-rule-summary', text: model.ruleSummary, x: topBar.x + 24, y: topBar.y + 74, fontSize: 21, color: '#2563eb', align: 'left', maxWidth: topBar.width - 48 });

    const actionSize = 62;
    model.actions.forEach((action, index) => {
      const rect = { x: topBar.x + topBar.width - (index + 1) * (actionSize + 12), y: topBar.y + 17, width: actionSize, height: actionSize };
      commands.push({ type: 'rect', id: `room-action-${action.action}`, rect, fill: '#dbeafe', radius: 16 });
      commands.push({ type: 'text', id: `room-action-${action.action}-text`, text: this.shortTitle(action.title), x: rect.x + rect.width / 2, y: rect.y + 39, fontSize: 18, color: '#1d4ed8', align: 'center' });
      hitAreas.push({ id: `hit-room-action-${action.action}`, action: action.action, rect });
    });

    const seatAreaTop = topBar.y + topBar.height + 46;
    const seatGap = 22;
    const seatWidth = (viewport.width - margin * 2 - seatGap) / 2;
    const seatHeight = 154;
    model.seats.forEach((seat, index) => {
      const rect = {
        x: margin + (index % 2) * (seatWidth + seatGap),
        y: seatAreaTop + Math.floor(index / 2) * (seatHeight + seatGap),
        width: seatWidth,
        height: seatHeight
      };
      this.renderSeat(seat, rect, commands, hitAreas);
    });

    const quickTop = seatAreaTop + Math.ceil(model.seats.length / 2) * (seatHeight + seatGap) + 28;
    commands.push({ type: 'text', id: 'quick-message-title', text: '快捷语', x: margin, y: quickTop, fontSize: 24, color: '#0f172a', align: 'left', weight: 'medium' });
    model.quickMessages.forEach((message, index) => {
      const rect = { x: margin + (index % 2) * (seatWidth + seatGap), y: quickTop + 22 + Math.floor(index / 2) * 62, width: seatWidth, height: 46 };
      commands.push({ type: 'rect', id: `quick-message-${index}`, rect, fill: '#ffffff', radius: 14, stroke: '#bfdbfe', lineWidth: 1 });
      commands.push({ type: 'text', id: `quick-message-${index}-text`, text: message, x: rect.x + rect.width / 2, y: rect.y + 30, fontSize: 20, color: '#1d4ed8', align: 'center', maxWidth: rect.width - 24 });
      hitAreas.push({ id: `hit-quick-message-${index}`, action: 'send_quick_message', rect, payload: { message } });
    });

    const primaryRect = { x: margin, y: viewport.height - safeBottom - 128, width: viewport.width - margin * 2, height: 82 };
    commands.push({ type: 'rect', id: 'room-primary', rect: primaryRect, fill: model.primaryButton.disabled ? '#94a3b8' : '#16a34a', radius: 18 });
    commands.push({ type: 'text', id: 'room-primary-text', text: model.primaryButton.title, x: primaryRect.x + primaryRect.width / 2, y: primaryRect.y + 52, fontSize: 30, color: '#ffffff', align: 'center', weight: 'bold' });
    if (model.primaryButton.reason) {
      commands.push({ type: 'text', id: 'room-primary-reason', text: model.primaryButton.reason, x: primaryRect.x + primaryRect.width / 2, y: primaryRect.y - 16, fontSize: 21, color: '#64748b', align: 'center' });
    }
    hitAreas.push({ id: 'hit-room-primary', action: model.primaryButton.action, rect: primaryRect, payload: { disabled: model.primaryButton.disabled } });

    return { width: viewport.width, height: viewport.height, commands, hitAreas };
  }

  private renderSeat(seat: RoomViewModel['seats'][number], rect: Rect, commands: RenderCommand[], hitAreas: HitArea[]): void {
    const fill = seat.empty ? '#ffffff' : seat.online ? '#e0f2fe' : '#e2e8f0';
    const stroke = seat.owner ? '#facc15' : seat.ready ? '#22c55e' : '#bfdbfe';
    commands.push({ type: 'rect', id: `room-seat-${seat.seatIndex}`, rect, fill, radius: 18, stroke, lineWidth: seat.owner || seat.ready ? 3 : 1 });
    commands.push({ type: 'circle', id: `room-seat-${seat.seatIndex}-avatar`, x: rect.x + 46, y: rect.y + 56, radius: 28, fill: seat.empty ? '#cbd5e1' : seat.isAi ? '#22c55e' : '#38bdf8' });
    commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-label`, text: seat.label, x: rect.x + 88, y: rect.y + 52, fontSize: 24, color: '#0f172a', align: 'left', weight: 'medium', maxWidth: rect.width - 104 });
    commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-status`, text: seat.empty ? '等待加入' : seat.online ? '在线' : '离线', x: rect.x + 88, y: rect.y + 86, fontSize: 20, color: seat.online ? '#0f766e' : '#64748b', align: 'left' });
    if (seat.badge) {
      commands.push({ type: 'text', id: `room-seat-${seat.seatIndex}-badge`, text: seat.badge, x: rect.x + rect.width - 18, y: rect.y + rect.height - 22, fontSize: 20, color: seat.ready ? '#16a34a' : '#1d4ed8', align: 'right' });
    }
    if (seat.empty) {
      hitAreas.push({ id: `hit-room-seat-${seat.seatIndex}`, action: 'invite_to_seat', rect, payload: { seatIndex: seat.seatIndex } });
    }
  }

  private shortTitle(title: string): string {
    if (title.includes('复制')) {
      return '复制';
    }
    if (title.includes('退出')) {
      return '退出';
    }
    return title;
  }
}

