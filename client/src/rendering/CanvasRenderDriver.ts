import type { RenderCommand, RenderTree } from './RenderCommand.js';

export type CanvasLikeContext = {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  globalAlpha: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

export type CanvasRenderDriverOptions = {
  imageResolver?: (assetKey: string) => unknown | null;
  fallbackFill?: string;
};

export class CanvasRenderDriver {
  constructor(private readonly ctx: CanvasLikeContext, private readonly options: CanvasRenderDriverOptions = {}) {}

  draw(tree: RenderTree): void {
    this.ctx.clearRect(0, 0, tree.width, tree.height);
    for (const command of tree.commands) {
      this.drawCommand(command);
    }
  }

  private drawCommand(command: RenderCommand): void {
    switch (command.type) {
      case 'rect':
        this.drawRect(command);
        return;
      case 'text':
        this.drawText(command);
        return;
      case 'image':
        this.drawImage(command);
        return;
      case 'circle':
        this.drawCircle(command);
        return;
      case 'arc':
        this.drawArc(command);
        return;
    }
  }

  private drawRect(command: Extract<RenderCommand, { type: 'rect' }>): void {
    this.ctx.save();
    this.ctx.fillStyle = command.fill;
    if (command.stroke) {
      this.ctx.strokeStyle = command.stroke;
      this.ctx.lineWidth = command.lineWidth ?? 1;
    }
    this.pathRoundedRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height, command.radius ?? 0);
    this.ctx.fill();
    if (command.stroke) {
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawText(command: Extract<RenderCommand, { type: 'text' }>): void {
    this.ctx.save();
    this.ctx.fillStyle = command.color;
    this.ctx.textAlign = command.align;
    this.ctx.textBaseline = 'alphabetic';
    const weight = command.weight === 'bold' ? '700' : command.weight === 'medium' ? '600' : '400';
    this.ctx.font = `${weight} ${command.fontSize}px sans-serif`;
    this.ctx.fillText(command.text, command.x, command.y, command.maxWidth);
    this.ctx.restore();
  }

  private drawImage(command: Extract<RenderCommand, { type: 'image' }>): void {
    const image = this.options.imageResolver?.(command.assetKey) ?? null;
    this.ctx.save();
    this.ctx.globalAlpha = command.alpha ?? 1;
    if (image) {
      if (command.rotation) {
        const cx = command.rect.x + command.rect.width / 2;
        const cy = command.rect.y + command.rect.height / 2;
        this.ctx.translate(cx, cy);
        this.ctx.rotate(command.rotation);
        this.ctx.drawImage(image, -command.rect.width / 2, -command.rect.height / 2, command.rect.width, command.rect.height);
      } else {
        this.ctx.drawImage(image, command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      }
    } else {
      this.ctx.fillStyle = this.options.fallbackFill ?? 'rgba(255,255,255,0.16)';
      this.pathRoundedRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height, 12);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawCircle(command: Extract<RenderCommand, { type: 'circle' }>): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = command.fill;
    this.ctx.fill();
    if (command.stroke) {
      this.ctx.strokeStyle = command.stroke;
      this.ctx.lineWidth = command.lineWidth ?? 1;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawArc(command: Extract<RenderCommand, { type: 'arc' }>): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(command.x, command.y, command.radius, command.startAngle, command.endAngle);
    this.ctx.strokeStyle = command.stroke;
    this.ctx.lineWidth = command.lineWidth;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private pathRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
}

