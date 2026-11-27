// Tactical raid HUD: compass, ammo, health, armor, and a contact reticle.
import * as THREE from 'three';
import { clamp } from './config.js';

export class Hud {
  constructor() {
    this.objective = document.getElementById('objective');
    this.contact = document.getElementById('contact');
    this.health = document.getElementById('health-fill');
    this.armor = document.getElementById('armor-fill');
    this.stamina = document.getElementById('stamina-fill');
    this.healthNum = document.getElementById('health-num');
    this.mag = document.getElementById('mag');
    this.reserve = document.getElementById('reserve');
    this.weaponName = document.getElementById('weapon-name');
    this.firemode = document.getElementById('firemode');
    this.stance = document.getElementById('stance');
    this.throwables = document.getElementById('throwables');
    this.message = document.getElementById('message');
    this.reticle = document.getElementById('reticle');
    this.hitmarker = document.getElementById('hitmarker');
    this.vignette = document.getElementById('damage-vignette');
    this.rpg = document.getElementById('rpg');
    this.prompt = document.getElementById('look-prompt');
    this.compass = document.getElementById('compass').getContext('2d');
    this.map = document.getElementById('minimap').getContext('2d');
    this.proj = new THREE.Vector3();
  }

  update(flight, missions, combat, camera) {
    const w = combat.weapon();
    const heading = flight.headingDeg();
    this.objective.textContent = missions.done ? '' : missions.message;
    this.contact.style.display = combat.contact > 0 && !missions.done ? 'block' : 'none';
    this.health.style.width = `${clamp(flight.hull, 0, 100)}%`;
    this.armor.style.width = `${clamp(combat.armor, 0, 50) * 2}%`;
    this.stamina.style.width = `${clamp(flight.stamina, 0, 100)}%`;
    this.healthNum.textContent = String(Math.round(flight.hull));
    this.mag.textContent = String(w.mag);
    this.reserve.textContent = String(w.reserve);
    this.weaponName.textContent = w.name;
    const auto = w.autoCapable && combat.auto;
    this.firemode.textContent = combat.reloading ? 'RELOAD' : (auto ? 'AUTO' : 'SEMI');
    this.firemode.className = combat.reloading ? 'reload' : (auto ? 'auto' : 'semi');
    this.stance.textContent = flight.sprinting ? 'SPRINT' : flight.prone ? 'PRONE' : flight.crouch ? 'CROUCH' : 'STAND';
    this.throwables.textContent = `FRAG ${combat.frags}   SMOKE ${combat.smokes}`;
    this.message.textContent = missions.done || flight.crashed ? missions.message : '';
    this.message.style.display = this.message.textContent ? 'block' : 'none';
    this.rpg.style.display = combat.rocketActive ? 'block' : 'none';
    const gap = 4 + combat.currentSpread * 1100;
    this.reticle.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    document.body.classList.toggle('ads', combat.ads);
    this.hitmarker.style.opacity = combat.hitMarker > 0 ? '1' : '0';
    const pain = clamp((1 - flight.hull / 100) * 0.65 + combat.shake * 0.45, 0, 0.9);
    this.vignette.style.opacity = String(pain);
    const locked = document.pointerLockElement === document.getElementById('game-canvas');
    const shot = new URLSearchParams(window.location.search).has('shot');
    this.prompt.style.display = locked || shot || missions.done ? 'none' : 'block';
    const target = missions.currentTarget(flight, combat);
    this.drawCompass(heading, target, flight);
    this.drawMap(flight, missions, combat);
  }

  drawCompass(heading, target, flight) {
    const ctx = this.compass;
    const w = 520;
    const h = 48;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8, 10, 9, 0.45)';
    ctx.fillRect(0, 8, w, 32);
    const px = 3.1;
    const center = w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.font = '11px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    for (let deg = -30; deg <= 420; deg += 15) {
      let delta = deg - heading;
      delta = ((delta + 540) % 360) - 180;
      const x = center + (deg - heading) * px;
      if (x < -30 || x > w + 30) continue;
      const major = deg % 45 === 0;
      ctx.strokeStyle = major ? 'rgba(231,226,214,0.9)' : 'rgba(231,226,214,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, major ? 12 : 18);
      ctx.lineTo(x, 30);
      ctx.stroke();
      if (major) {
        const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        ctx.fillStyle = (deg % 360) === 0 ? '#e2b657' : '#e7e2d6';
        ctx.fillText(names[(deg / 45) % 8], x, 44);
      }
    }
    const dx = target.x - flight.position.x;
    const dz = target.z - flight.position.z;
    let bearing = (THREE.MathUtils.radToDeg(Math.atan2(dx, dz)) + 360) % 360;
    let diff = bearing - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const mx = clamp(center + diff * px, 8, w - 8);
    ctx.fillStyle = '#e2b657';
    ctx.beginPath();
    ctx.moveTo(mx, 8);
    ctx.lineTo(mx - 6, 16);
    ctx.lineTo(mx + 6, 16);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(center, 6);
    ctx.lineTo(center - 5, 0);
    ctx.lineTo(center + 5, 0);
    ctx.fill();
  }

  drawMap(flight, missions, combat) {
    const ctx = this.map;
    const w = 168;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(10, 16, 14, 0.82)';
    ctx.fillRect(0, 0, w, w);
    const scale = 0.055;
    const cx = w / 2;
    const cy = w / 2;
    const toMap = (x, z) => [
      cx + (x - flight.position.x) * scale,
      cy + (z - flight.position.z) * scale,
    ];
    ctx.save();
    ctx.beginPath();
    ctx.rect(2, 2, w - 4, w - 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120, 140, 110, 0.35)';
    ctx.strokeRect(8, 8, w - 16, w - 16);
    const target = missions.currentTarget(flight, combat);
    for (const site of combat.targets) {
      const [sx, sy] = toMap(site.x, site.z);
      ctx.fillStyle = site.alive ? '#e2b657' : '#667064';
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }
    for (const e of combat.enemies) {
      if (!e.alive || !e.alert) continue;
      const [ex, ey] = toMap(e.x, e.z);
      ctx.fillStyle = '#ff5a45';
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
    }
    const [tx, ty] = toMap(target.x, target.z);
    ctx.strokeStyle = '#e2b657';
    ctx.strokeRect(tx - 5, ty - 5, 10, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(flight.heading);
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
