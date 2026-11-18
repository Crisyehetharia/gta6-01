// Teluk Cerah — synthesized sound.
//
// No audio files: every sound is a small WebAudio oscillator or filtered
// noise burst, built the first time the player presses a key. The engine
// hum follows the car's speed and the siren wails while the police chase.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenFlip: 0,
    muted: false,
    ready: false,
  };
}

// Must be called from a user gesture at least once.
export function ensureAudio(A) {
  if (A.ready) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.5;
    A.master.connect(A.ctx.destination);
    // Engine: low sawtooth through a low-pass filter.
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    const filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    A.engineOsc.connect(filt);
    filt.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();
    // Siren: square wave whose pitch flips between two tones.
    A.sirenOsc = A.ctx.createOscillator();
    A.sirenOsc.type = 'square';
    A.sirenOsc.frequency.value = 720;
    A.sirenGain = A.ctx.createGain();
    A.sirenGain.gain.value = 0;
    A.sirenOsc.connect(A.sirenGain);
    A.sirenGain.connect(A.master);
    A.sirenOsc.start();
    A.ready = true;
  } catch (e) {
    A.ready = false;
  }
}

function tone(A, freq, dur, type, vol, when) {
  if (!A.ready || A.muted) return;
  const t0 = A.ctx.currentTime + (when || 0);
  const osc = A.ctx.createOscillator();
  const g = A.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.16, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(A.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(A, dur, vol, freq) {
  if (!A.ready || A.muted) return;
  const len = Math.floor(A.ctx.sampleRate * dur);
  const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = A.ctx.createBufferSource();
  src.buffer = buf;
  const filt = A.ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq || 900;
  const g = A.ctx.createGain();
  g.gain.value = vol || 0.25;
  src.connect(filt);
  filt.connect(g);
  g.connect(A.master);
  src.start();
}

// One-shot effects by name.
export function sfx(A, name) {
  if (!A.ready) return;
  if (name === 'pickup') {
    tone(A, 660, 0.12, 'sine', 0.18, 0);
    tone(A, 990, 0.18, 'sine', 0.18, 0.1);
  } else if (name === 'deliver') {
    tone(A, 523, 0.12, 'triangle', 0.2, 0);
    tone(A, 659, 0.12, 'triangle', 0.2, 0.11);
    tone(A, 784, 0.22, 'triangle', 0.2, 0.22);
  } else if (name === 'punch') {
    noiseBurst(A, 0.09, 0.3, 500);
  } else if (name === 'crash') {
    noiseBurst(A, 0.22, 0.32, 700);
    tone(A, 90, 0.2, 'square', 0.14, 0);
  } else if (name === 'steal') {
    tone(A, 330, 0.1, 'square', 0.12, 0);
    tone(A, 415, 0.14, 'square', 0.12, 0.09);
  } else if (name === 'arrest') {
    tone(A, 392, 0.25, 'sawtooth', 0.14, 0);
    tone(A, 311, 0.25, 'sawtooth', 0.14, 0.24);
    tone(A, 233, 0.45, 'sawtooth', 0.14, 0.48);
  } else if (name === 'click') {
    tone(A, 880, 0.06, 'sine', 0.12, 0);
  }
}

// Called every frame: engine follows speed, siren follows wanted level.
export function updateAudio(A, speed, inCar, wanted, dt) {
  if (!A.ready) return;
  if (A.muted) {
    A.engineGain.gain.value = 0;
    A.sirenGain.gain.value = 0;
    return;
  }
  const target = inCar ? 0.045 + Math.min(0.05, speed * 0.00012) : 0;
  A.engineGain.gain.value += (target - A.engineGain.gain.value) * Math.min(1, dt * 6);
  A.engineOsc.frequency.value = 52 + speed * 0.32;
  if (wanted > 0) {
    A.sirenGain.gain.value = 0.035;
    A.sirenFlip += dt;
    if (A.sirenFlip > 0.45) {
      A.sirenFlip = 0;
      A.sirenOsc.frequency.value = A.sirenOsc.frequency.value < 850 ? 980 : 720;
    }
  } else {
    A.sirenGain.gain.value = 0;
  }
}

export function setMuted(A, muted) {
  A.muted = muted;
  if (A.ready && A.master) A.master.gain.value = muted ? 0 : 0.5;
}
