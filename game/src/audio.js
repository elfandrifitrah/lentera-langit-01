// Procedural Web Audio: gunshots, footsteps, a low raid bed, and stingers.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.lastStep = 0;
    this.lastBeat = 0;
  }

  start() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sine';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
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
    windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(windFilter).connect(this.windGain).connect(this.master);
    wind.start();
  }

  noiseBurst(time, freq, q, gainValue, dur) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  tone(time, freq, gainValue, dur, type = 'sine') {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  update(flight, missions, combat) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const contact = combat && combat.contact > 0;
    this.engineOsc.frequency.value = contact ? 62 : 46;
    this.engineGain.gain.value = flight.crashed ? 0 : (contact ? 0.04 : 0.018);
    this.windGain.gain.value = Math.min(0.045, flight.speed * 0.0035);
    const interval = flight.sprinting ? 0.32 : flight.crouch ? 0.58 : 0.46;
    if (flight.speed > 1.15 && !flight.airborne && !flight.crashed && now - this.lastStep > interval) {
      this.lastStep = now;
      this.footstep();
    }
    if (flight.hull < 38 && !flight.crashed && now - this.lastBeat > (flight.hull < 20 ? 0.48 : 0.78)) {
      this.lastBeat = now;
      this.heartbeat();
    }
    if (missions && missions.done) this.engineGain.gain.value = 0.01;
  }

  footstep() {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 180, 0.7, 0.12, 0.05);
  }

  heartbeat() {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, 58, 0.16, 0.12, 'sine');
  }

  gunshot(light = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, light ? 1600 : 780, 0.6, light ? 0.28 : 0.5, light ? 0.07 : 0.12);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(light ? 240 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  cannon() { this.gunshot(false); }

  empty() {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, 1400, 0.05, 0.03, 'square');
  }

  hit() {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, 1800, 0.06, 0.04, 'square');
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 140, 0.5, 0.7, 0.35);
    this.tone(t, 70, 0.22, 0.28, 'sine');
  }

  missileWarn() {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, 880, 0.07, 0.18, 'square');
    this.tone(this.ctx.currentTime + 0.16, 660, 0.06, 0.16, 'square');
  }

  thud() { if (this.ctx) this.noiseBurst(this.ctx.currentTime, 120, 0.8, 0.2, 0.08); }

  chime(index) {
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    this.tone(this.ctx.currentTime, scale[index % scale.length], 0.07, 0.22, 'sine');
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(t + i * 0.12, freq, 0.07, 0.35, 'sine'));
  }
}
