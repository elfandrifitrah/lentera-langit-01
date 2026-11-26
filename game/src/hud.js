// Live instrument panel: six-pack flight gauges plus an engine cluster.
// Every gauge redraws each frame from flight state and prints its value.
import { WORLD, clamp } from './config.js';

const W = 64;
const C = W / 2;
const START = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;

function face(ctx) {
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#17100b';
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = '#8a6a45';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = START + (i / 10) * SWEEP;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(a) * (C - 8), C + Math.sin(a) * (C - 8));
    ctx.lineTo(C + Math.cos(a) * (C - 3), C + Math.sin(a) * (C - 3));
    ctx.stroke();
  }
}

function arc(ctx, from01, to01, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(C, C, C - 5.5, START + from01 * SWEEP, START + to01 * SWEEP);
  ctx.stroke();
}

function needle(ctx, frac, color = '#ffd696') {
  const a = START + clamp(frac, 0, 1) * SWEEP;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(a) * (C - 11), C + Math.sin(a) * (C - 11));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(C, C, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function valueText(ctx, text, y = C + 16) {
  ctx.fillStyle = '#fff7e6';
  ctx.font = 'bold 12px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText(text, C, y);
}

export class Hud {
  constructor() {
    this.alt = document.getElementById('hud-alt');
    this.spd = document.getElementById('hud-spd');
    this.hdg = document.getElementById('hud-hdg');
    this.banner = document.getElementById('mission-banner');
    this.stall = document.getElementById('stall');
    this.fuel = document.getElementById('fuel-fill');
    this.hull = document.getElementById('hull-fill');
    this.thr = document.getElementById('thr-fill');
    this.message = document.getElementById('message');
    this.gauges = {};
    for (const id of ['spd', 'att', 'alt', 'tc', 'hdg', 'vsi', 'rpm', 'map', 'aoa', 'oilp', 'oilt', 'fuel']) {
      this.gauges[id] = document.getElementById('g-' + id).getContext('2d');
    }
    this.lamps = {
      flaps: document.getElementById('lamp-flaps'),
      stall: document.getElementById('lamp-stall'),
      fuellow: document.getElementById('lamp-fuellow'),
    };
    this.map = document.getElementById('minimap').getContext('2d');
    this.prevHeading = null;
    this.turnRate = 0;
    this.lastTime = performance.now();
  }

  update(flight, missions) {
    const now = performance.now();
    const dt = Math.max((now - this.lastTime) / 1000, 0.001);
    this.lastTime = now;
    const heading = flight.headingDeg();
    if (this.prevHeading !== null) {
      let d = heading - this.prevHeading;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      this.turnRate = this.turnRate * 0.8 + (d / dt) * 0.2;
    }
    this.prevHeading = heading;

    const altFt = flight.altitudeFt();
    const spdKt = flight.speedKt();
    const vsiFpm = flight.verticalSpeed * 196.85;
    const rpm = 650 + flight.rpm * 2050;
    const mapInHg = 9 + flight.throttle * 20 - altFt * 0.0011;
    const oilP = flight.rpm > 0.02 ? 30 + flight.rpm * 55 : 0;
    const oilT = 55 + flight.rpm * 50 - clamp(flight.speed * 0.12, 0, 8);
    const fuelGal = flight.fuel * 0.4;
    const pathAngle = flight.speed > 3 ? Math.asin(clamp(flight.verticalSpeed / flight.speed, -1, 1)) : 0;
    const aoaDeg = (flight.pitch - pathAngle) * 57.2958;
    const slip = clamp(Math.sin(flight.roll) * -0.6 + this.turnRate * -0.02, -1, 1);

    this.alt.textContent = `${Math.round(altFt)} FT`;
    this.spd.textContent = `${Math.round(spdKt)} KT`;
    this.hdg.textContent = String(Math.round(heading)).padStart(3, '0');
    this.banner.textContent = missions.message;
    this.stall.style.display = flight.stalled ? 'block' : 'none';
    this.fuel.style.width = `${clamp(flight.fuel, 0, 100)}%`;
    this.hull.style.width = `${clamp(flight.hull, 0, 100)}%`;
    this.thr.style.width = `${flight.throttle * 100}%`;
    this.message.textContent = missions.done ? missions.message : '';
    this.lamps.flaps.className = 'lamp' + (flight.flaps ? ' on' : '');
    this.lamps.stall.className = 'lamp warn' + (flight.stalled ? ' on' : '');
    this.lamps.fuellow.className = 'lamp warn' + (flight.fuel < 20 ? ' on' : '');

    let ctx = this.gauges.spd;
    face(ctx);
    arc(ctx, 0.08, 0.42, '#e8e8e8');
    arc(ctx, 0.3, 0.82, '#3fae5a');
    arc(ctx, 0.82, 0.95, '#e8c33a');
    arc(ctx, 0.95, 1, '#e33a2e');
    needle(ctx, spdKt / 160);
    valueText(ctx, `${Math.round(spdKt)}`);

    ctx = this.gauges.att;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(C, C);
    ctx.rotate(-flight.roll);
    ctx.translate(0, flight.pitch * 38);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-C, -C * 2, W, C * 2);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(-C, 0, W, C * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (const p of [-20, -10, 10, 20]) {
      ctx.beginPath();
      ctx.moveTo(-9, p * 1.1);
      ctx.lineTo(9, p * 1.1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#ffd696';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(C - 15, C);
    ctx.lineTo(C + 15, C);
    ctx.stroke();
    valueText(ctx, `${Math.round(flight.pitch * 57.3)}° ${Math.round(Math.abs(flight.roll * 57.3))}°`, C + 27);

    ctx = this.gauges.alt;
    face(ctx);
    needle(ctx, (altFt % 1000) / 1000);
    valueText(ctx, `${Math.round(altFt)}`);

    ctx = this.gauges.tc;
    face(ctx);
    ctx.save();
    ctx.translate(C, C - 4);
    ctx.rotate(clamp(this.turnRate * 0.06, -0.6, 0.6));
    ctx.strokeStyle = '#ffd696';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.moveTo(0, -3);
    ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#8a6a45';
    ctx.strokeRect(C - 14, C + 8, 28, 7);
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath();
    ctx.arc(C + slip * 11, C + 11.5, 3, 0, Math.PI * 2);
    ctx.fill();
    valueText(ctx, `${this.turnRate.toFixed(1)}°/s`, C + 27);

    ctx = this.gauges.hdg;
    face(ctx);
    needle(ctx, heading / 360, '#7dff8a');
    valueText(ctx, String(Math.round(heading)).padStart(3, '0'));

    ctx = this.gauges.vsi;
    face(ctx);
    needle(ctx, 0.5 + clamp(vsiFpm / 2000, -0.5, 0.5));
    valueText(ctx, `${vsiFpm >= 0 ? '+' : ''}${Math.round(vsiFpm)}`);

    ctx = this.gauges.rpm;
    face(ctx);
    arc(ctx, 0.62, 0.93, '#3fae5a');
    arc(ctx, 0.93, 1, '#e33a2e');
    needle(ctx, rpm / 2900, '#ff9d5c');
    valueText(ctx, `${Math.round(rpm)}`);

    ctx = this.gauges.map;
    face(ctx);
    arc(ctx, 0.35, 0.8, '#3fae5a');
    needle(ctx, mapInHg / 35, '#ff9d5c');
    valueText(ctx, mapInHg.toFixed(1));

    ctx = this.gauges.aoa;
    face(ctx);
    arc(ctx, 0.55, 0.75, '#e8c33a');
    arc(ctx, 0.75, 1, '#e33a2e');
    needle(ctx, (aoaDeg + 5) / 25, aoaDeg > 13 ? '#ff5a4e' : '#ffd696');
    valueText(ctx, `${aoaDeg.toFixed(1)}°`);

    ctx = this.gauges.oilp;
    face(ctx);
    arc(ctx, 0.45, 0.85, '#3fae5a');
    needle(ctx, oilP / 110, oilP < 25 && flight.rpm > 0.02 ? '#ff5a4e' : '#ffd696');
    valueText(ctx, `${Math.round(oilP)}`);

    ctx = this.gauges.oilt;
    face(ctx);
    arc(ctx, 0.4, 0.8, '#3fae5a');
    needle(ctx, oilT / 140);
    valueText(ctx, `${Math.round(oilT)}°`);

    ctx = this.gauges.fuel;
    face(ctx);
    arc(ctx, 0, 0.18, '#e33a2e');
    needle(ctx, flight.fuel / 100, flight.fuel < 20 ? '#ff5a4e' : '#ffd696');
    valueText(ctx, fuelGal.toFixed(1));

    this.drawMap(flight, missions);
  }

  drawMap(flight, missions) {
    const ctx = this.map;
    const w = 170;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#14405c';
    ctx.fillRect(0, 0, w, w);
    const toMap = (x, z) => [((x + 3200) / 6400) * w, ((z + 3200) / 6400) * w];
    ctx.fillStyle = '#3f9e4d';
    for (const [x, z, r] of [[650, 950, 16], [-350, 1250, 14], [-1500, 300, 18], [1400, -1100, 15], [100, -1500, 17], [-1250, -850, 13]]) {
      const [mx, my] = toMap(x, z);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const target = missions.currentTarget(flight);
    const [tx, ty] = toMap(target.x, target.z);
    ctx.fillStyle = '#ff8c2e';
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
    const [px, py] = toMap(flight.position.x, flight.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(flight.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
