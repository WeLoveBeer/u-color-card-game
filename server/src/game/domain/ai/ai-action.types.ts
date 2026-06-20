import type { CardId, PlayerId } from '@shared/domain/game-state.js';
import type { PlayableColor } from '@shared/domain/card.js';

export type AiAction =
  | { type: 'play_card'; cardIds: CardId[]; chooseColor?: PlayableColor }
  | { type: 'draw_card' }
  | { type: 'pass_turn' }
  | { type: 'call_u' }
  | { type: 'catch_missed_call'; targetPlayerId: PlayerId }
  | { type: 'plus_four_response'; action: 'draw' | 'challenge' | 'stack_plus_four'; cardId?: CardId; chooseColor?: PlayableColor };

export type ScoredAiAction = {
  action: AiAction;
  score: number;
  reason: string;
};
