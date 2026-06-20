import { describe, expect, it } from 'vitest';
import { CanvasRenderDriver, type CanvasLikeContext } from './CanvasRenderDriver.js';
import type { RenderTree } from './RenderCommand.js';

class MockCanvasContext implements CanvasLikeContext {
  ops: string[] = [];
  globalAlpha = 1;
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign: CanvasTextAlign = 'left';
  textBaseline: CanvasTextBaseline = 'alphabetic';

  save(): void {
    this.ops.push('save');
  }
  restore(): void {
    this.ops.push('restore');
  }
  clearRect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`clear:${x},${y},${width},${height}`);
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`fillRect:${x},${y},${width},${height}`);
  }
  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ops.push(`strokeRect:${x},${y},${width},${height}`);
  }
  beginPath(): void {
    this.ops.push('beginPath');
  }
  moveTo(x: number, y: number): void {
    this.ops.push(`moveTo:${x},${y}`);
  }
  lineTo(x: number, y: number): void {
    this.ops.push(`lineTo:${x},${y}`);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.ops.push(`quadratic:${cpx},${cpy},${x},${y}`);
  }
  closePath(): void {
    this.ops.push('closePath');
  }
  fill(): void {
    this.ops.push(`fill:${this.fillStyle}`);
  }
  stroke(): void {
    this.ops.push(`stroke:${this.strokeStyle}:${this.lineWidth}`);
  }
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.ops.push(`arc:${x},${y},${radius},${startAngle},${endAngle}`);
  }
  translate(x: number, y: number): void {
    this.ops.push(`translate:${x},${y}`);
  }
  rotate(angle: number): void {
    this.ops.push(`rotate:${angle}`);
  }
  drawImage(_image: unknown, x: number, y: number, width: number, height: number): void {
    this.ops.push(`drawImage:${x},${y},${width},${height}`);
  }
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.ops.push(`text:${text}:${x},${y}:${maxWidth ?? ''}:${this.font}:${this.textAlign}`);
  }
}

describe('CanvasRenderDriver', () => {
  it('按 RenderTree 顺序绘制基础命令', () => {
    const ctx = new MockCanvasContext();
    const tree: RenderTree = {
      width: 300,
      height: 200,
      hitAreas: [],
      commands: [
        { type: 'rect', id: 'panel', rect: { x: 10, y: 10, width: 80, height: 40 }, fill: '#123', radius: 8 },
        { type: 'text', id: 'label', text: '喊 U', x: 50, y: 38, fontSize: 20, color: '#fff', align: 'center', weight: 'bold' },
        { type: 'image', id: 'card', assetKey: 'card.blue.2', rect: { x: 100, y: 20, width: 50, height: 72 } },
        { type: 'circle', id: 'avatar', x: 30, y: 90, radius: 12, fill: '#38bdf8' },
        { type: 'arc', id: 'ring', x: 150, y: 100, radius: 42, startAngle: 0, endAngle: 1, stroke: '#fff', lineWidth: 4 }
      ]
    };

    new CanvasRenderDriver(ctx, { imageResolver: () => ({}) }).draw(tree);

    expect(ctx.ops[0]).toBe('clear:0,0,300,200');
    expect(ctx.ops).toContain('text:喊 U:50,38::700 20px sans-serif:center');
    expect(ctx.ops).toContain('drawImage:100,20,50,72');
    expect(ctx.ops).toContain('arc:150,100,42,0,1');
  });

  it('图片未加载时使用占位绘制，保证界面不空白', () => {
    const ctx = new MockCanvasContext();
    const tree: RenderTree = {
      width: 100,
      height: 100,
      hitAreas: [],
      commands: [{ type: 'image', id: 'missing', assetKey: 'missing.asset', rect: { x: 8, y: 9, width: 40, height: 50 } }]
    };

    new CanvasRenderDriver(ctx, { imageResolver: () => null, fallbackFill: '#abc' }).draw(tree);

    expect(ctx.ops).not.toContain('drawImage:8,9,40,50');
    expect(ctx.ops).toContain('fill:#abc');
  });
});

