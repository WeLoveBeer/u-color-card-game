import type { CardColor } from '@shared/index.js';

export type DirectionRingViewModel = {
  direction: 1 | -1;
  color: CardColor;
  clockwise: boolean;
};

export class DirectionRingView {
  build(direction: 1 | -1, color: CardColor): DirectionRingViewModel {
    return { direction, color, clockwise: direction === 1 };
  }
}
