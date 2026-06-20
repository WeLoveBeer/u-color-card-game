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
    } else if (this.drawCardFallback(command)) {
      // Card SVGs may fail in the WeChat canvas runtime; keep gameplay readable.
    } else {
      ctx.fillStyle = this.fallbackFill;
      this.roundedRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height, command.radius ?? 12);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCardFallback(command) {
    if (command.assetKey !== 'card_back.default' && !command.assetKey?.startsWith('card.')) {
      return false;
    }

    const { rect, assetKey } = command;
    const parts = assetKey === 'card_back.default' ? ['card', 'back', 'default'] : assetKey.split('.');
    if (command.rotation) {
      const ctx = this.ctx;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(command.rotation);
      this.drawCardFallbackBody(-rect.width / 2, -rect.height / 2, rect.width, rect.height, parts);
    } else {
      this.drawCardFallbackBody(rect.x, rect.y, rect.width, rect.height, parts);
    }
    return true;
  }

  drawCardFallbackBody(x, y, width, height, parts) {
    if (parts[1] === 'back') {
      this.drawCardBackFallback(x, y, width, height);
      return;
    }

    const color = parts[1];
    const label = this.cardFallbackLabel(parts);
    const fill = this.cardFallbackColor(color);
    const ink = color === 'yellow' ? '#073263' : '#ffffff';
    const corner = Math.max(10, Math.round(Math.min(width, height) * 0.10));
    const inset = Math.max(4, Math.round(width * 0.07));
    const ctx = this.ctx;

    this.roundedRect(x, y, width, height, corner);
    ctx.fillStyle = '#f8fbff';
    ctx.fill();

    this.roundedRect(x + inset, y + inset, width - inset * 2, height - inset * 2, Math.max(6, corner - 3));
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.save();
    ctx.globalAlpha *= 0.22;
    this.roundedRect(x + width * 0.19, y + height * 0.29, width * 0.62, height * 0.42, Math.max(5, corner - 4));
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${this.fitFontSize(label, width * 0.62, height * 0.34)}px sans-serif`;
    ctx.fillText(label, x + width / 2, y + height / 2);

    ctx.font = `900 ${Math.max(10, Math.round(width * 0.22))}px sans-serif`;
    ctx.fillText(label, x + width * 0.23, y + height * 0.18);
  }

  drawCardBackFallback(x, y, width, height) {
    const ctx = this.ctx;
    const corner = Math.max(10, Math.round(Math.min(width, height) * 0.10));
    const inset = Math.max(5, Math.round(width * 0.08));
    this.roundedRect(x, y, width, height, corner);
    ctx.fillStyle = '#f8fbff';
    ctx.fill();
    this.roundedRect(x + inset, y + inset, width - inset * 2, height - inset * 2, Math.max(6, corner - 4));
    ctx.fillStyle = '#075fa9';
    ctx.fill();
    this.roundedRect(x + width * 0.23, y + height * 0.28, width * 0.54, height * 0.44, Math.max(5, corner - 5));
    ctx.fillStyle = 'rgba(125, 211, 252, 0.45)';
    ctx.fill();
    ctx.fillStyle = '#dff7ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.max(13, Math.round(width * 0.25))}px sans-serif`;
    ctx.fillText('U', x + width / 2, y + height / 2);
  }

  cardFallbackLabel(parts) {
    const type = parts[2];
    if (!type) {
      return '?';
    }
    if (/^\d+$/.test(type)) {
      return type;
    }
    if (type === 'plus2') {
      return '+2';
    }
    if (type === 'plus4') {
      return '+4';
    }
    if (type === 'reverse') {
      return 'R';
    }
    if (type === 'skip') {
      return 'S';
    }
    if (type === 'color') {
      return 'W';
    }
    return type.slice(0, 1).toUpperCase();
  }

  cardFallbackColor(color) {
    const colors = {
      red: '#ef4444',
      yellow: '#facc15',
      blue: '#1993ff',
      green: '#22c55e',
      wild: '#20232a'
    };
    return colors[color] ?? '#475569';
  }

  fitFontSize(text, maxWidth, maxSize) {
    const size = Math.max(14, Math.round(maxSize));
    if (String(text).length <= 1) {
      return size;
    }
    return Math.max(12, Math.round(Math.min(size, maxWidth / String(text).length * 1.4)));
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
