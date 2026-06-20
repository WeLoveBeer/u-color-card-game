import type { Card, PlayableColor } from '@shared/domain/card.js';
import type { DomainEvent, GameState, NextTurnPolicy, PlayerId } from '@shared/domain/game-state.js';
import { EffectHandlerRegistry } from './effect-handler.registry.js';

export type ResolvedEffect = {
  state: GameState;
  events: DomainEvent[];
  nextTurnPolicy: NextTurnPolicy;
};

export class EffectResolver {
  constructor(private readonly registry = new EffectHandlerRegistry()) {}

  resolve(state: GameState, playerId: PlayerId, card: Card, chooseColor?: PlayableColor): ResolvedEffect {
    const handler = this.registry.get(card.type);
    const result = handler.resolve({ state, playerId, card, chooseColor }, card);
    return {
      state: result.state,
      events: result.events,
      nextTurnPolicy: result.nextTurnPolicy ?? { type: 'normal' }
    };
  }
}
