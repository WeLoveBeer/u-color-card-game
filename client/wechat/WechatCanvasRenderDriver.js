export class WechatCanvasRenderDriver {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.imageResolver = options.imageResolver ?? (() => null);
    this.fallbackFill = options.fallbackFill ?? 'rgba(255,255,255,0.16)';
  }

  draw(tree) {
    this.ctx.clearRect(0, 0, tree.width, tree.height);
    for (const command of tree.commands) {
      this.drawCommand(command);
    }
  }

  drawCommand(command) {
    if (command.type === 'rect') {
      this.drawRect(command);
    } else if (command.type === 'text') {
      this.drawText(command);
    } else if (command.type === 'image') {
      this.drawImage(command);
    } else if (command.type === 'circle') {
      this.drawCircle(command);
    } else if (command.type === 'arc') {
      this.drawArc(command);
    }
  }

  drawRect(command) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = command.fill;
    if (command.stroke) {
      ctx.strokeStyle = command.stroke;
      ctx.lineWidth = command.lineWidth ?? 1;
    }
    this.roundedRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height, command.radius ?? 0);
    ctx.fill();
    if (command.stroke) {
      ctx.stroke();
    }
    ctx.restore();
  }

  drawText(command) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = command.color;
    ctx.textAlign = command.align;
    ctx.textBaseline = 'alphabetic';
    const weight = command.weight === 'bold' ? '900' : command.weight === 'medium' ? '800' : '600';
    ctx.font = `${weight} ${command.fontSize}px sans-serif`;
    ctx.fillText(command.text, command.x, command.y, command.maxWidth);
    ctx.restore();
  }

  drawImage(command) {
    const ctx = this.ctx;
    const image = this.imageResolver(command.assetKey);
    ctx.save();
    ctx.globalAlpha = command.alpha ?? 1;
    if (image) {
      if (command.rotation) {
        const cx = command.rect.x + command.rect.width / 2;
        const cy = command.rect.y + command.rect.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(command.rotation);
        ctx.drawImage(image, -command.rect.width / 2, -command.rect.height / 2, command.rect.width, command.rect.height);
      } else {
        ctx.drawImage(image, command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      }
    } else {
      ctx.fillStyle = this.fallbackFill;
      this.roundedRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height, command.radius ?? 12);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCircle(command) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
    ctx.fillStyle = command.fill;
    ctx.fill();
    if (command.stroke) {
      ctx.strokeStyle = command.stroke;
      ctx.lineWidth = command.lineWidth ?? 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawArc(command) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(command.x, command.y, command.radius, command.startAngle, command.endAngle);
    ctx.strokeStyle = command.stroke;
    ctx.lineWidth = command.lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  roundedRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
