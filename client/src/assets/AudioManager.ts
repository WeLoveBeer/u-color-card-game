import { AudioCatalog, type AudioCue } from './AudioCatalog.js';

export class AudioManager {
  musicEnabled = true;
  sfxEnabled = true;

  constructor(private readonly catalog = new AudioCatalog()) {}

  play(cue: AudioCue): string | null {
    if (!this.sfxEnabled) {
      return null;
    }
    return this.catalog.resolve(cue);
  }
}
