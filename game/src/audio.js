// Procedural Web Audio: engine, wind, theme motif, and one-shot effects.
const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];
const MOTIF = [0, 2, 4, 3, 2, 1, 2, 0, 0, 2, 4, 5, 4, 3, 2, 1];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.intensity = 0.4;
  }

  start() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 500;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    this.nextNoteTime = ctx.currentTime + 0.1;
  }

  pluck(freq, time, gainValue, decay = 0.7) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const harm = ctx.createOscillator();
    harm.type = 'sine';
    harm.frequency.value = freq * 2.76;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    const hg = ctx.createGain();
    hg.gain.value = 0.35;
    osc.connect(g).connect(this.master);
    harm.connect(hg).connect(g);
    osc.start(time);
    harm.start(time);
    osc.stop(time + decay + 0.05);
    harm.stop(time + decay + 0.05);
  }

  drum(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(55, time + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  noiseBurst(time, duration, freq, gainValue) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 0.22), time + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  update(flight, missions, combat) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.engineOsc.frequency.value = 48 + flight.rpm * 150;
    this.engineGain.gain.value = flight.crashed ? 0 : 0.028 + flight.rpm * 0.075;
    this.windGain.gain.value = Math.min(0.12, flight.speed * 0.0016);
    const fighting = combat && (combat.missileWarning || combat.destroyed > 0);
    this.intensity = missions.done ? 0.9 : fighting ? 0.75 : flight.airborne ? 0.55 : 0.28;
    const stepDur = 60 / (missions.stage === 1 ? 104 : 92) / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.18) {
      const idx = this.step % MOTIF.length;
      const note = SCALE[MOTIF[idx]];
      this.pluck(note, this.nextNoteTime, 0.045 + this.intensity * 0.055);
      if (this.step % 4 === 0) this.drum(this.nextNoteTime);
      if (this.intensity > 0.65 && this.step % 2 === 0) this.pluck(note * 2, this.nextNoteTime, 0.02, 0.4);
      this.step++;
      this.nextNoteTime += stepDur;
    }
    if (flight.stalled && (!this.nextStall || ctx.currentTime >= this.nextStall)) {
      this.pluck(494, ctx.currentTime, 0.06, 0.09);
      this.nextStall = ctx.currentTime + 0.18;
    }
    if (combat && combat.missileWarning && (!this.nextBeep || ctx.currentTime >= this.nextBeep)) {
      this.pluck(880, ctx.currentTime, 0.07, 0.07);
      this.nextBeep = ctx.currentTime + 0.26;
    }
  }

  chime(index) { if (this.ctx) this.pluck(SCALE[index % SCALE.length] * 2, this.ctx.currentTime, 0.12, 0.9); }
  cannon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.07, 2100, 0.22);
    this.drum(t);
  }
  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.48, 520, 0.42);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(96, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.42);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }
  flak() {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 0.18, 900, 0.16);
  }
  whoosh() {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 0.22, 2400, 0.1);
  }
  flare() {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 0.28, 4200, 0.08);
  }
  missileWarn() { if (this.ctx) this.pluck(880, this.ctx.currentTime, 0.08, 0.25); }
  thud() { if (this.ctx) this.drum(this.ctx.currentTime); }
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 5].forEach((n, i) => this.pluck(SCALE[n] * 2, t + i * 0.14, 0.1, 1.1));
  }
}
