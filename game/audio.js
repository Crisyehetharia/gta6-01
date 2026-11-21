// Bandar Pelita — synthesized sound via WebAudio. No audio files.
const Snd = (() => {
  let ctx = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { return false; }
    return true;
  }
  function init() { ensure(); }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || G.muted) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }
  function engine(speed01) {
    if (!ensure() || G.muted) { engineStop(); return; }
    try {
      if (ctx.state === 'suspended') ctx.resume();
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = speed01 > 0.02 ? 0.05 + speed01 * 0.09 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  }
  function engineStop() {
    if (engineGain && ctx) {
      try { engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
    }
  }
  function siren(on) {
    if (!ensure()) return;
    if (!on) {
      if (sirenOsc) { try { sirenOsc.stop(); } catch (e) { /* ignore */ } sirenOsc = null; }
      return;
    }
    if (G.muted) { siren(false); return; }
    try {
      if (ctx.state === 'suspended') ctx.resume();
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.frequency.value = 720;
        sirenOsc.start();
        sirenHigh = true;
      }
      sirenTimer += 1 / 60;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 720 : 540, ctx.currentTime, 0.03);
      }
    } catch (e) { /* ignore */ }
  }
  return {
    init,
    blip() { tone(880, 0.09, 'sine', 0.18, 1320); },
    thud() { tone(140, 0.14, 'square', 0.25, 60); },
    crash() { tone(90, 0.3, 'sawtooth', 0.3, 40); tone(55, 0.35, 'square', 0.2, 30); },
    pickup() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90); },
    jingle() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 120));
    },
    fail() { tone(320, 0.4, 'sawtooth', 0.2, 140); },
    engine, engineStop, siren,
  };
})();
