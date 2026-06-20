import type { Card, CardType } from '@shared/domain/card.js';
import type { AiHint, DomainEvent, GameState, NextTurnPolicy, RuleContext } from '@shared/domain/game-state.js';

export type EffectResult = {
  state: GameState;
  events: DomainEvent[];
  nextTurnPolicy?: NextTurnPolicy;
};

export type CardEffectHandler = {
  type: CardType;
  resolve(ctx: RuleContext, card: Card): EffectResult;
  getAiHints?(ctx: RuleContext, card: Card): AiHint;
};
