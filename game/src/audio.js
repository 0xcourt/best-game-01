// Every sound in the game, synthesised with WebAudio: no audio files, no
// network. The context is made lazily on the first user gesture (browsers
// refuse sound before one), every call is guarded, and M or the speaker
// button mutes the master gain.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from any user gesture: unlocks sound for the session. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    try {
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  function noise(seconds, volume, when = 0, lowpass = 1200) {
    if (!ensure() || muted) return;
    try {
      const start = ctx.currentTime + when;
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },

    /** The engine hum, called every frame with the speed fraction 0..1. */
    engine(fraction) {
      if (!ensure() || muted) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineFilter = ctx.createBiquadFilter();
          engineFilter.type = 'lowpass';
          engineFilter.frequency.value = 320;
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          engineOsc.connect(engineFilter);
          engineFilter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const target = fraction > 0.02 ? 0.045 + fraction * 0.05 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(52 + fraction * 96, ctx.currentTime, 0.08);
      } catch {
        // Sound is garnish: a failure here must never break the game.
      }
    },

    /** The angkot horn: two tones at once, the classic "tot-tot". */
    horn() {
      tone(370, 0.16, 'square', 0.16);
      tone(466, 0.16, 'square', 0.16);
      tone(370, 0.14, 'square', 0.14, 0.2);
      tone(466, 0.14, 'square', 0.14, 0.2);
    },

    /** A fare paid: a bright two-note coin ding. */
    coin() {
      tone(880, 0.12, 'sine', 0.22);
      tone(1318, 0.22, 'sine', 0.2, 0.09);
    },

    /** A passenger stepping aboard: a soft pop. */
    pop() { tone(520, 0.09, 'sine', 0.18, 0, 760); },

    /** A button tap: a short click. */
    click() { tone(660, 0.06, 'sine', 0.14); },

    /** A bump into traffic: a thud and a scrape. */
    crash() {
      noise(0.22, 0.5, 0, 900);
      tone(90, 0.28, 'sine', 0.4, 0, 45);
    },

    /** Low fuel warning: one short beep. */
    beep() { tone(980, 0.12, 'square', 0.1); },

    /** A passenger giving up and leaving: a sad little fall. */
    sigh() { tone(420, 0.3, 'sine', 0.14, 0, 240); },

    /** A shift cleared: a rising four-note jingle. */
    jingle() {
      tone(523, 0.16, 'sine', 0.22);
      tone(659, 0.16, 'sine', 0.22, 0.14);
      tone(784, 0.16, 'sine', 0.22, 0.28);
      tone(1046, 0.34, 'sine', 0.24, 0.42);
    },

    /** A shift failed: three notes falling. */
    descend() {
      tone(392, 0.22, 'sine', 0.2);
      tone(330, 0.22, 'sine', 0.2, 0.2);
      tone(262, 0.42, 'sine', 0.2, 0.4);
    },
  };
}
