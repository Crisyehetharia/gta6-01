// audio.js — synthesized WebAudio sound. No audio files, no network.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  _tone(freq, dur, type = 'sine', vol = 0.5, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  click() { this._tone(660, 0.07, 'square', 0.25); }
  pickup() { this._tone(523, 0.1, 'sine', 0.5); this._tone(784, 0.16, 'sine', 0.5, 0.09); }
  punch() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.09;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    src.buffer = buf; src.connect(g); g.connect(this.master); src.start(t0);
  }
  crash() { this._tone(110, 0.25, 'sawtooth', 0.5); this._tone(70, 0.3, 'square', 0.4, 0.03); }
  complete() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.16, 'sine', 0.5, i * 0.11)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.22, 'sawtooth', 0.35, i * 0.16)); }
  wantedUp() { this._tone(880, 0.09, 'square', 0.3); this._tone(1108, 0.12, 'square', 0.3, 0.08); }

  engine(on, speedRatio) {
    if (!this.ctx) return;
    if (on && !this.muted) {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.04;
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 55 + speedRatio * 90;
      this.engineGain.gain.value = 0.03 + speedRatio * 0.05;
    } else if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc.disconnect();
      this.engineOsc = null; this.engineGain = null;
    }
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.muted) {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenGain.gain.value = 0.05;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        let hi = false;
        this.sirenTimer = setInterval(() => {
          if (this.sirenOsc) this.sirenOsc.frequency.value = hi ? 950 : 700;
          hi = !hi;
        }, 420);
      }
    } else if (this.sirenOsc) {
      clearInterval(this.sirenTimer);
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null; this.sirenGain = null; this.sirenTimer = null;
    }
  }

  stopAll() {
    this.engine(false, 0);
    this.siren(false);
  }
}
