// Original, gently voiced sound effects generated locally; no audio downloads.
// Each note is [frequency, start offset, duration, ending frequency, waveform].
export const CUES = {
  block: [[1800, 0, .04, 550, 'triangle']],
  run: [[440, 0, .13], [660, .10, .18]],
  move: [[280, 0, .09, 420, 'triangle'], [660, .06, .085, 440, 'sine']],
  press: [[520, 0, .1, 780, 'triangle'], [1047, .085, .2]],
  jump: [[260, 0, .19, 740, 'sine']],
  bump: [[140, 0, .13, 65, 'triangle'], [330, .05, .08, 180, 'sine']],
  error: [[262, 0, .18, 220, 'triangle'], [175, .17, .25, 147, 'triangle']],
  collect: [[784, 0, .14], [988, .09, .15], [1319, .18, .22]],
  success: [[523, 0, .19], [659, .14, .19], [784, .28, .19], [1047, .44, .5]],
  complete: [[523, 0, .18], [659, .13, .18], [784, .26, .18], [1047, .40, .23], [988, .63, .18], [1175, .79, .2], [1568, .98, .55]],
  reset: [[660, 0, .1, 440], [440, .09, .12, 330]],
  on: [[660, 0, .12], [880, .1, .2]]
};

export class SoundEffects {
  constructor({ enabled = true, createContext, onStatus = () => {}, resumeTimeout = 1500 } = {}) {
    this.enabled = enabled;
    this.context = null;
    this.voices = new Set();
    this.generation = 0;
    this.onStatus = onStatus;
    this.resumeTimeout = resumeTimeout;
    this.createContext = createContext || (() => {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      return AudioContext ? new AudioContext() : null;
    });
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) this.cancel();
  }

  cancel() {
    this.generation++;
    for (const voice of this.voices) {
      try { voice.oscillator.stop(); } catch {}
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    this.voices.clear();
  }

  async play(name) {
    if (!this.enabled || !Object.hasOwn(CUES, name)) return false;
    const generation = this.generation;
    try {
      if (!this.context || this.context.state === 'closed') this.context = this.createContext();
      if (!this.context) { this.onStatus('unavailable'); return false; }
      // Called from a click before animation starts, satisfying autoplay rules.
      if (this.context.state !== 'running') {
        let timer;
        try {
          await Promise.race([
            this.context.resume(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio activation timed out')), this.resumeTimeout); })
          ]);
        } finally { clearTimeout(timer); }
      }
      if (!this.enabled || generation !== this.generation) return false;
      if (this.context.state !== 'running') { this.onStatus('blocked'); return false; }
      const start = this.context.currentTime + .01;
      for (const [frequency, offset, duration, ending = frequency, waveform = 'sine'] of CUES[name]) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const at = start + offset;
        oscillator.type = waveform;
        oscillator.frequency.setValueAtTime(frequency, at);
        oscillator.frequency.exponentialRampToValueAtTime(ending, at + duration);
        gain.gain.setValueAtTime(.0001, at);
        // A brief sustain makes the notes audible on laptop and phone speakers.
        // The old envelope immediately faded from a very low peak.
        gain.gain.linearRampToValueAtTime(.22, at + .008);
        gain.gain.setValueAtTime(.22, at + duration * .55);
        gain.gain.linearRampToValueAtTime(.0001, at + duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        const voice = { oscillator, gain };
        this.voices.add(voice);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.voices.delete(voice);
        };
        oscillator.start(at);
        oscillator.stop(at + duration + .015);
      }
      this.onStatus('playing');
      return true;
    } catch {
      if (this.enabled && generation === this.generation) this.onStatus('blocked');
      return false;
    }
  }
}
