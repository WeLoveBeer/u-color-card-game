export type CardColor = 'red' | 'yellow' | 'blue' | 'green' | 'wild';

export type PlayableColor = Exclude<CardColor, 'wild'>;

export type CardType =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'plus_two'
  | 'wild_color'
  | 'wild_plus_four'
  | 'same_color_dump'
  | 'balloon'
  | 'swap_hand'
  | 'color_lock';

export type Card = {
  id: string;
  color: CardColor;
  type: CardType;
  value?: string;
};

export const PLAYABLE_COLORS: readonly PlayableColor[] = ['red', 'yellow', 'blue', 'green'];

export function isPlayableColor(color: CardColor): color is PlayableColor {
  return color !== 'wild';
}
