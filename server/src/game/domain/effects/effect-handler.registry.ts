import type { CardType } from '@shared/domain/card.js';
import type { CardEffectHandler } from './effect-handler.js';
import { NumberHandler } from './handlers/number.handler.js';
import { SkipHandler } from './handlers/skip.handler.js';
import { ReverseHandler } from './handlers/reverse.handler.js';
import { PlusTwoHandler } from './handlers/plus-two.handler.js';
import { WildColorHandler } from './handlers/wild-color.handler.js';
import { WildPlusFourHandler } from './handlers/wild-plus-four.handler.js';
import { SameColorDumpHandler } from './handlers/same-color-dump.handler.js';
import { PlaceholderHandler } from './handlers/placeholder.handler.js';

export class EffectHandlerRegistry {
  private readonly handlers = new Map<CardType, CardEffectHandler>();

  constructor(handlers: CardEffectHandler[] = defaultEffectHandlers()) {
    for (const handler of handlers) {
      this.handlers.set(handler.type, handler);
    }
  }

  get(type: CardType): CardEffectHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`effect handler not registered: ${type}`);
    }
    return handler;
  }
}

export function defaultEffectHandlers(): CardEffectHandler[] {
  return [
    new NumberHandler(),
    new SkipHandler(),
    new ReverseHandler(),
    new PlusTwoHandler(),
    new WildColorHandler(),
    new WildPlusFourHandler(),
    new SameColorDumpHandler(),
    new PlaceholderHandler('balloon'),
    new PlaceholderHandler('swap_hand'),
    new PlaceholderHandler('color_lock')
  ];
}
