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

  update(flight, missions) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.engineOsc.frequency.value = 55 + flight.rpm * 130;
    this.engineGain.gain.value = flight.crashed ? 0 : 0.03 + flight.rpm * 0.07;
    this.windGain.gain.value = Math.min(0.12, flight.speed * 0.0016);
    this.intensity = missions.stage === 2 ? 0.8 : flight.airborne ? 0.6 : 0.3;
    const stepDur = 60 / 92 / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.18) {
      const idx = this.step % MOTIF.length;
      const note = SCALE[MOTIF[idx]];
      this.pluck(note, this.nextNoteTime, 0.05 + this.intensity * 0.06);
      if (this.step % 4 === 0) this.drum(this.nextNoteTime);
      if (this.intensity > 0.65 && this.step % 2 === 0) this.pluck(note * 2, this.nextNoteTime, 0.02, 0.4);
      this.step++;
      this.nextNoteTime += stepDur;
    }
    if (flight.stalled && this.step % 2 === 0) this.pluck(880, ctx.currentTime, 0.03, 0.12);
  }

  chime(index) { if (this.ctx) this.pluck(SCALE[index % SCALE.length] * 2, this.ctx.currentTime, 0.12, 0.9); }
  cannon() { if (this.ctx) this.drum(this.ctx.currentTime, 0.05); }
  explosion() { if (this.ctx) this.drum(this.ctx.currentTime, 0.4); }
  missileWarn() { if (this.ctx) this.pluck(880, this.ctx.currentTime, 0.08, 0.25); }
  thud() { if (this.ctx) this.drum(this.ctx.currentTime); }
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 5].forEach((n, i) => this.pluck(SCALE[n] * 2, t + i * 0.14, 0.1, 1.1));
  }
}
