import type { CardType, PlayableColor } from '@shared/index.js';

export type AudioCue =
  | { type: 'card'; cardType: CardType }
  | { type: 'color'; color: PlayableColor }
  | { type: 'sfx'; name: 'button' | 'card_play' | 'card_draw' | 'win' | 'lose' | 'reward' | 'countdown' };

export class AudioCatalog {
  resolve(cue: AudioCue): string {
    if (cue.type === 'color') {
      return `audio/voice_color_${cue.color}.wav`;
    }
    if (cue.type === 'card') {
      const map: Partial<Record<CardType, string>> = {
        plus_two: 'audio/voice_plus_two.wav',
        skip: 'audio/voice_skip.wav',
        reverse: 'audio/voice_reverse.wav'
      };
      return map[cue.cardType] ?? 'audio/sfx_card_play.wav';
    }
    return `audio/sfx_${cue.name}.wav`;
  }
}
