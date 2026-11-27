// Infantry combat on the existing island: carbine, sidearm, frags, smoke,
// garrisoned compounds, and rockets from the gun pits.
import * as THREE from 'three';
import { clamp } from './config.js';
import { terrainHeight } from './terrain.js';

const SITES = [
  { name: 'North OP', x: 200, z: 500, hp: 80, kind: 'radar', garrison: 3 },
  { name: 'MG West', x: -60, z: 640, hp: 70, kind: 'aaa', garrison: 2 },
  { name: 'MG East', x: 40, z: 860, hp: 70, kind: 'aaa', garrison: 2 },
  { name: 'Supply cache', x: -300, z: 1100, hp: 90, kind: 'depot', garrison: 3 },
];

const LOADOUT = [
  { id: 'carbine', name: 'M4A1', magSize: 30, reserveMax: 90, rpm: 740, autoCapable: true, damage: 28, head: 1.85, spread: 0.014, adsSpread: 0.0022, recoil: 0.011, range: 170, reload: 1.85 },
  { id: 'sidearm', name: 'M19', magSize: 12, reserveMax: 36, rpm: 420, autoCapable: false, damage: 22, head: 1.7, spread: 0.02, adsSpread: 0.0055, recoil: 0.02, range: 60, reload: 1.35 },
];

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function buildInstallation(def) {
  const g = new THREE.Group();
  const y = Math.max(terrainHeight(def.x, def.z), 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 3, 10), lambert(0x6b6f66));
  base.position.y = 1.5;
  g.add(base);
  if (def.kind === 'radar') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 16, 8), lambert(0x9aa3a8));
    tower.position.y = 10;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.7, 16), lambert(0xd5dde2));
    dish.position.y = 19;
    dish.rotation.z = 0.5;
    g.add(tower, dish);
  } else if (def.kind === 'aaa') {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), lambert(0x55604e));
    mount.position.y = 5;
    g.add(mount);
    for (const dx of [-1.6, 1.6]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 11, 6), lambert(0x2b2f33));
      barrel.position.set(dx, 10, 0);
      barrel.rotation.x = -0.7;
      g.add(barrel);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 8), lambert(0x7a6a4a));
      shed.position.set((i - 1) * 13, 4, (i % 2) * 6 - 3);
      g.add(shed);
    }
  }
  g.position.set(def.x, y, def.z);
  return g;
}

function buildSoldier() {
  const g = new THREE.Group();
  const cloth = lambert(0x8a7048);
  const dark = lambert(0x3a342c);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), cloth);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), lambert(0xc49a78));
  head.position.y = 1.68;
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), dark);
  helm.position.y = 1.84;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), lambert(0xa33b32));
  band.position.set(-0.28, 1.25, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), dark);
  legL.position.set(-0.12, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.12;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.62), lambert(0x1c1e1a));
  gun.position.set(0.16, 1.15, -0.28);
  g.add(torso, head, helm, band, legL, legR, gun);
  return g;
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weapons = LOADOUT.map((def) => ({ ...def, mag: def.magSize, reserve: def.reserveMax }));
    this.weaponIndex = 0;
    this.auto = true;
    this.targets = SITES.map((def) => {
      const group = buildInstallation(def);
      scene.add(group);
      return {
        ...def,
        group,
        y: group.position.y + 6,
        alive: true,
        hpLeft: def.hp,
        aliveGarrison: def.garrison,
        missileTimer: 5 + Math.random() * 3,
      };
    });
    this.enemies = [];
    for (const site of this.targets) {
      const ring = site.kind === 'depot' ? 28 : 22;
      for (let i = 0; i < site.garrison; i++) {
        const ang = (i / site.garrison) * Math.PI * 2 + 0.6;
        const x = site.x + Math.sin(ang) * ring;
        const z = site.z + Math.cos(ang) * ring;
        const group = buildSoldier();
        const feetY = Math.max(terrainHeight(x, z), 0);
        group.position.set(x, feetY, z);
        scene.add(group);
        this.enemies.push({
          group, site, x, z, homeX: x, homeZ: z, feetY,
          y: feetY + 1.05, hp: 100, alive: true, alert: false,
          fireTimer: 1 + Math.random() * 1.5, phase: Math.random() * 6,
        });
      }
    }
    this.tracerPool = [];
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 1.15), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
      mesh.visible = false;
      scene.add(mesh);
      this.tracerPool.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }
    this.rocketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 8), new THREE.MeshBasicMaterial({ color: 0xdedad2 }));
    this.rocketMesh.visible = false;
    scene.add(this.rocketMesh);
    this.rocketVel = new THREE.Vector3();
    this.rocketActive = false;
    this.grenadePool = [];
    this.smokePool = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3d4636 }));
      mesh.visible = false;
      scene.add(mesh);
      this.grenadePool.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, kind: 'frag' });
    }
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xd5d5d0, transparent: true, opacity: 0.32 }));
      mesh.visible = false;
      scene.add(mesh);
      this.smokePool.push({ mesh, x: 0, y: 0, z: 0, life: 0, radius: 8 });
    }
    this.boom = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9d3c, transparent: true, opacity: 0 }));
    scene.add(this.boom);
    this.boomLife = 0;
    this.reset();
  }

  reset() {
    this.weaponIndex = 0;
    this.auto = true;
    this.ads = false;
    this.reloadTimer = 0;
    this.reloading = false;
    this.fireCooldown = 0;
    this.switchTimer = 0;
    this.frags = 2;
    this.smokes = 2;
    this.throwCooldown = 0;
    this.armor = 50;
    this.shake = 0;
    this.hitMarker = 0;
    this.muzzleTimer = 0;
    this.currentSpread = 0.014;
    this.regenDelay = 0;
    this.contact = 0;
    this.kills = 0;
    this.scoreGained = 0;
    this.rocketActive = false;
    this.missileWarning = false;
    if (this.rocketMesh) this.rocketMesh.visible = false;
    for (const w of this.weapons) {
      w.mag = w.magSize;
      w.reserve = w.reserveMax;
    }
    if (this.targets) {
      for (const t of this.targets) {
        t.alive = true;
        t.hpLeft = t.hp;
        t.aliveGarrison = t.garrison;
        t.group.visible = true;
        t.group.rotation.z = 0;
        t.missileTimer = 5;
      }
    }
    if (this.enemies) {
      for (const e of this.enemies) {
        e.alive = true;
        e.hp = 100;
        e.alert = false;
        e.x = e.homeX;
        e.z = e.homeZ;
        e.feetY = Math.max(terrainHeight(e.homeX, e.homeZ), 0);
        e.y = e.feetY + 1.05;
        e.group.visible = true;
        e.group.rotation.z = 0;
        e.group.position.set(e.homeX, e.feetY, e.homeZ);
        e.fireTimer = 1;
      }
    }
    if (this.grenadePool) for (const g of this.grenadePool) { g.life = 0; g.mesh.visible = false; }
    if (this.smokePool) for (const s of this.smokePool) { s.life = 0; s.mesh.visible = false; }
  }

  weapon() { return this.weapons[this.weaponIndex]; }

  installationsLeft() { return this.targets.filter((t) => t.alive).length; }

  enemiesAlive() { return this.enemies.filter((e) => e.alive).length; }

  nearestTarget(flight) {
    let best = null;
    let bestD = Infinity;
    const x = flight ? flight.position.x : 0;
    const z = flight ? flight.position.z : 0;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best || this.targets[0];
  }

  inSmoke(x, z) {
    return this.smokePool.some((s) => s.life > 0 && Math.hypot(s.x - x, s.z - z) < s.radius);
  }

  nearestSmoke(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const s of this.smokePool) {
      if (s.life <= 0) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  explodeAt(pos, audio) {
    this.boom.position.copy(pos);
    this.boomLife = 0.45;
    this.boom.scale.set(1, 1, 1);
    audio.explosion();
  }

  damageTarget(t, dmg, audio) {
    if (!t.alive) return;
    if (dmg < 500 && t.aliveGarrison > 0) {
      t.hpLeft -= dmg;
      this.hitMarker = 0.08;
      return;
    }
    t.alive = false;
    t.group.rotation.z = 0.4;
    this.scoreGained += 250;
    this.explodeAt(t.group.position.clone().add(new THREE.Vector3(0, 4, 0)), audio);
  }

  damageEnemy(e, dmg, audio, head) {
    if (!e.alive) return;
    e.hp -= dmg;
    this.hitMarker = 0.12;
    if (e.hp > 0) {
      audio.hit();
      return;
    }
    e.alive = false;
    e.group.rotation.z = 1.25;
    e.group.position.y = e.feetY + 0.15;
    this.kills += 1;
    this.scoreGained += head ? 150 : 100;
    audio.hit();
    if (e.site) {
      e.site.aliveGarrison = Math.max(0, e.site.aliveGarrison - 1);
      if (e.site.aliveGarrison <= 0) this.damageTarget(e.site, 9999, audio);
    }
  }

  hurt(flight, amount, audio) {
    if (flight.crashed || amount <= 0) return;
    const absorbed = Math.min(this.armor, amount * 0.55);
    this.armor -= absorbed;
    flight.hull = Math.max(0, flight.hull - (amount - absorbed));
    this.regenDelay = 4.4;
    this.shake = Math.min(1.2, this.shake + 0.5);
    this.contact = 2.2;
    audio.thud();
    if (flight.hull <= 0) {
      flight.hull = 0;
      flight.crashed = true;
    }
  }

  blocked(a, b) {
    const steps = 8;
    for (let i = 1; i < steps; i++) {
      const p = a.clone().lerp(b, i / steps);
      if (p.y <= Math.max(terrainHeight(p.x, p.z), 0) + 0.4) return true;
    }
    return false;
  }

  trace(origin, dir, maxDist) {
    let groundT = maxDist;
    for (let t = 1; t < maxDist; t += 1.5) {
      const p = origin.clone().addScaledVector(dir, t);
      if (p.y <= Math.max(terrainHeight(p.x, p.z), 0) + 0.15) { groundT = t; break; }
    }
    let best = null;
    let bestT = groundT;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ox = e.x - origin.x;
      const oy = (e.feetY + 1.05) - origin.y;
      const oz = e.z - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0.6 || t > bestT) continue;
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const horiz = Math.hypot(px - e.x, pz - e.z);
      const bodyY = py - e.feetY;
      if (horiz < 0.42 && bodyY > 0.25 && bodyY < 1.9) {
        bestT = t;
        best = { enemy: e, head: bodyY > 1.48, dist: t, point: new THREE.Vector3(px, py, pz) };
      }
    }
    for (const site of this.targets) {
      if (!site.alive) continue;
      const radius = site.kind === 'depot' ? 10 : 6;
      const ox = site.x - origin.x;
      const oz = site.z - origin.z;
      const t = ox * dir.x + oz * dir.z;
      if (t < 1 || t > bestT) continue;
      const px = origin.x + dir.x * t;
      const pz = origin.z + dir.z * t;
      const py = origin.y + dir.y * t;
      if (Math.hypot(px - site.x, pz - site.z) < radius && py > site.group.position.y && py < site.group.position.y + 16) {
        bestT = t;
        best = { target: site, dist: t, point: new THREE.Vector3(px, py, pz) };
      }
    }
    return best;
  }

  hitsPlayer(origin, dir, maxDist, flight) {
    let limit = maxDist;
    for (let t = 1; t < maxDist; t += 2) {
      const p = origin.clone().addScaledVector(dir, t);
      if (p.y <= Math.max(terrainHeight(p.x, p.z), 0) + 0.3) { limit = t; break; }
    }
    const feet = flight.position;
    const chestY = feet.y + (flight.prone ? 0.3 : flight.crouch ? 0.7 : 1.05);
    const ox = feet.x - origin.x;
    const oy = chestY - origin.y;
    const oz = feet.z - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 1 || t > limit) return false;
    const px = origin.x + dir.x * t;
    const py = origin.y + dir.y * t;
    const pz = origin.z + dir.z * t;
    const horiz = Math.hypot(px - feet.x, pz - feet.z);
    const bodyY = py - feet.y;
    const height = flight.prone ? 0.5 : flight.crouch ? 1.15 : 1.8;
    return horiz < (flight.prone ? 0.5 : 0.4) && bodyY > 0.05 && bodyY < height;
  }

  spawnTracer(origin, dir, color, speed) {
    const slot = this.tracerPool.find((t) => t.life <= 0);
    if (!slot) return;
    slot.mesh.position.copy(origin);
    slot.mesh.lookAt(origin.clone().add(dir));
    slot.mesh.material.color.set(color);
    slot.vel.copy(dir).multiplyScalar(speed);
    slot.life = 0.18;
    slot.mesh.visible = true;
  }

  spreadFor(flight, steady) {
    const w = this.weapon();
    let spread = this.ads ? w.adsSpread : w.spread;
    if (flight.sprinting) spread *= 2.5;
    else if (flight.speed > 2.2) spread *= 1.45;
    if (flight.crouch) spread *= 0.8;
    if (flight.prone) spread *= 0.62;
    if (steady && this.ads && flight.speed < 0.5) spread *= 0.4;
    return spread;
  }

  tryFire(flight, audio, actions) {
    const w = this.weapon();
    if (this.reloadTimer > 0 || this.switchTimer > 0 || flight.crashed) return;
    if (w.mag <= 0) {
      if (actions.firePressed) {
        audio.empty();
        this.beginReload(audio);
      }
      return;
    }
    const automatic = w.autoCapable && this.auto;
    if (!(automatic ? actions.fireHeld : actions.firePressed)) return;
    if (this.fireCooldown > 0) return;
    this.fireCooldown = 60 / w.rpm;
    w.mag -= 1;
    const spread = this.spreadFor(flight, actions.steady);
    this.currentSpread = spread;
    const dir = flight.aimDir();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread * 0.8;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const origin = flight.eyePosition();
    const hit = this.trace(origin, dir, w.range);
    const falloff = !hit ? 1 : hit.dist < 35 ? 1 : clamp(1 - (hit.dist - 35) / w.range, 0.42, 1);
    if (hit && hit.enemy) this.damageEnemy(hit.enemy, w.damage * (hit.head ? w.head : 1) * falloff, audio, hit.head);
    else if (hit && hit.target) this.damageTarget(hit.target, 6, audio);
    else audio.gunshot(w.id === 'sidearm');
    if (hit) audio.gunshot(w.id === 'sidearm');
    this.spawnTracer(origin, dir, 0xfff1c2, 240);
    flight.recoilPitch += w.recoil * (this.ads ? 0.55 : 1);
    flight.recoilYaw += (Math.random() - 0.5) * w.recoil * 0.65;
    this.muzzleTimer = 0.04;
  }

  beginReload(audio) {
    const w = this.weapon();
    if (this.reloadTimer > 0 || w.mag >= w.magSize || w.reserve <= 0) return;
    this.reloadTimer = w.reload;
    this.reloading = true;
    this.ads = false;
    audio.thud();
  }

  finishReload() {
    const w = this.weapon();
    const need = w.magSize - w.mag;
    const take = Math.min(need, w.reserve);
    w.mag += take;
    w.reserve -= take;
    this.reloading = false;
  }

  throwItem(flight, kind) {
    if (this.throwCooldown > 0) return;
    if (kind === 'frag' && this.frags <= 0) return;
    if (kind === 'smoke' && this.smokes <= 0) return;
    const slot = this.grenadePool.find((g) => g.life <= 0);
    if (!slot) return;
    if (kind === 'frag') this.frags -= 1;
    else this.smokes -= 1;
    this.throwCooldown = 0.7;
    const dir = flight.aimDir();
    slot.kind = kind;
    slot.life = kind === 'frag' ? 2.1 : 0.85;
    slot.pos.copy(flight.eyePosition());
    slot.vel.copy(dir).multiplyScalar(kind === 'frag' ? 16 : 14).add(new THREE.Vector3(0, 5, 0));
    slot.mesh.visible = true;
    slot.mesh.material.color.set(kind === 'frag' ? 0x3d4636 : 0xd7d3c8);
  }

  blast(pos, radius, damage, flight, audio) {
    this.explodeAt(pos, audio);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - pos.x, (e.feetY + 1) - pos.y, e.z - pos.z);
      if (d < radius) this.damageEnemy(e, damage * (1 - d / radius), audio, false);
    }
    for (const site of this.targets) {
      if (!site.alive) continue;
      const d = Math.hypot(site.x - pos.x, site.z - pos.z);
      if (d < radius + 6) this.damageTarget(site, 20, audio);
    }
    const self = Math.hypot(flight.position.x - pos.x, flight.position.z - pos.z);
    if (self < radius) this.hurt(flight, damage * 0.45 * (1 - self / radius), audio);
  }

  popSmoke(pos) {
    const slot = this.smokePool.find((s) => s.life <= 0) || this.smokePool[0];
    slot.life = 14;
    slot.x = pos.x;
    slot.y = pos.y + 1.5;
    slot.z = pos.z;
    slot.radius = 8;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, slot.y, slot.z);
    slot.mesh.scale.set(slot.radius, 3.2, slot.radius);
  }

  enemyShot(e, flight, audio) {
    const eye = flight.eyePosition();
    const origin = new THREE.Vector3(e.x, e.feetY + 1.35, e.z);
    if (this.blocked(origin, eye)) return;
    const dist = origin.distanceTo(eye);
    if (dist > 78) return;
    const smoked = this.inSmoke(flight.position.x, flight.position.z) || this.inSmoke(e.x, e.z);
    const dir = eye.clone().sub(origin).normalize();
    let spread = (0.018 + dist * 0.00055) * (smoked ? 5.5 : 1);
    if (flight.crouch) spread *= 1.7;
    if (flight.prone) spread *= 2.3;
    if (flight.sprinting) spread *= 0.75;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    this.spawnTracer(origin, dir, 0xff4a3a, 180);
    audio.gunshot(true);
    this.contact = Math.max(this.contact, 1.4);
    if (!smoked && this.hitsPlayer(origin, dir, 90, flight)) this.hurt(flight, 12, audio);
  }

  launchRocket(site, flight, audio) {
    this.rocketActive = true;
    this.missileWarning = true;
    this.rocketMesh.visible = true;
    this.rocketMesh.position.set(site.x, site.group.position.y + 8, site.z);
    const dir = flight.eyePosition().sub(this.rocketMesh.position).normalize();
    this.rocketVel.copy(dir).multiplyScalar(18);
    audio.missileWarn();
  }

  update(dt, flight, actions, audio, live = true) {
    this.fireCooldown -= dt;
    this.throwCooldown -= dt;
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.contact = Math.max(0, this.contact - dt);
    this.shake = Math.max(0, this.shake - dt * 1.7);
    if (this.switchTimer > 0) this.switchTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    if (actions.weapon != null && actions.weapon !== this.weaponIndex && actions.weapon < this.weapons.length) {
      this.weaponIndex = actions.weapon;
      this.switchTimer = 0.28;
      this.reloadTimer = 0;
      this.reloading = false;
      this.ads = false;
    }
    if (actions.reload) this.beginReload(audio);
    this.ads = !!actions.ads && this.reloadTimer <= 0 && this.switchTimer <= 0 && !flight.sprinting && !flight.crashed;
    this.currentSpread = this.spreadFor(flight, actions.steady);
    if (live && !flight.crashed) {
      this.tryFire(flight, audio, actions);
      if (actions.grenade) this.throwItem(flight, 'frag');
      if (actions.smoke) this.throwItem(flight, 'smoke');
    }

    if (this.regenDelay > 0) this.regenDelay -= dt;
    else if (!flight.crashed && flight.hull > 0 && flight.hull < 100) flight.hull = Math.min(100, flight.hull + 22 * dt);

    if (this.boomLife > 0) {
      this.boomLife -= dt;
      const s = 1 + (0.45 - this.boomLife) * 4;
      this.boom.scale.set(s, s, s);
      this.boom.material.opacity = clamp(this.boomLife * 1.8, 0, 0.8);
    } else this.boom.material.opacity = 0;

    for (const slot of this.tracerPool) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.mesh.position.addScaledVector(slot.vel, dt);
      if (slot.life <= 0) slot.mesh.visible = false;
    }

    for (const g of this.grenadePool) {
      if (g.life <= 0) continue;
      g.life -= dt;
      g.vel.y -= 16 * dt;
      g.pos.addScaledVector(g.vel, dt);
      const ground = Math.max(terrainHeight(g.pos.x, g.pos.z), 0);
      if (g.pos.y < ground + 0.15) {
        g.pos.y = ground + 0.15;
        g.vel.y *= -0.28;
        g.vel.x *= 0.6;
        g.vel.z *= 0.6;
      }
      g.mesh.position.copy(g.pos);
      if (g.life <= 0) {
        g.mesh.visible = false;
        if (g.kind === 'frag') this.blast(g.pos.clone(), 7.5, 95, flight, audio);
        else this.popSmoke(g.pos);
      }
    }

    for (const s of this.smokePool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = clamp(s.life / 14, 0, 0.34);
      if (s.life <= 0) s.mesh.visible = false;
    }

    const playerEye = flight.eyePosition();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.phase += dt;
      const sx = e.homeX + Math.sin(e.phase * 0.55) * 1.3;
      const sz = e.homeZ + Math.cos(e.phase * 0.42) * 1.3;
      e.x = sx;
      e.z = sz;
      e.feetY = Math.max(terrainHeight(sx, sz), 0);
      e.y = e.feetY + 1.05;
      e.group.position.set(sx, e.feetY, sz);
      const dx = flight.position.x - sx;
      const dz = flight.position.z - sz;
      e.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
      const dist = Math.hypot(dx, dz);
      const origin = new THREE.Vector3(sx, e.feetY + 1.35, sz);
      if (dist < 70 && !this.blocked(origin, playerEye)) e.alert = true;
      if (!live || flight.crashed || !e.alert) continue;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && dist < 78) {
        e.fireTimer = 0.7 + Math.random() * 0.65;
        this.enemyShot(e, flight, audio);
      }
    }

    this.missileWarning = this.rocketActive;
    if (live && !this.rocketActive && !flight.crashed) {
      for (const site of this.targets) {
        if (!site.alive || site.kind !== 'aaa') continue;
        const d = Math.hypot(site.x - flight.position.x, site.z - flight.position.z);
        site.missileTimer -= dt;
        if (d < 95 && site.missileTimer <= 0) {
          site.missileTimer = 8 + Math.random() * 3;
          this.launchRocket(site, flight, audio);
          break;
        }
      }
    }
    if (this.rocketActive) {
      const smoke = this.inSmoke(flight.position.x, flight.position.z) ? this.nearestSmoke(flight.position.x, flight.position.z) : null;
      const target = smoke
        ? new THREE.Vector3(smoke.x, smoke.y, smoke.z)
        : flight.eyePosition();
      const desired = target.clone().sub(this.rocketMesh.position);
      if (desired.lengthSq() > 0.01) desired.normalize().multiplyScalar(32);
      this.rocketVel.lerp(desired, clamp(dt * 1.7, 0, 1));
      this.rocketMesh.position.addScaledVector(this.rocketVel, dt);
      if (this.rocketVel.lengthSq() > 0.01) {
        this.rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.rocketVel.clone().normalize());
      }
      const dPlayer = this.rocketMesh.position.distanceTo(flight.position);
      const dSmoke = smoke ? this.rocketMesh.position.distanceTo(target) : 99;
      const ground = Math.max(terrainHeight(this.rocketMesh.position.x, this.rocketMesh.position.z), 0);
      if (smoke && dSmoke < 3.5) {
        this.rocketActive = false;
        this.rocketMesh.visible = false;
        this.explodeAt(this.rocketMesh.position.clone(), audio);
        this.scoreGained += 40;
      } else if (dPlayer < 1.35) {
        this.rocketActive = false;
        this.rocketMesh.visible = false;
        this.explodeAt(this.rocketMesh.position.clone(), audio);
        this.hurt(flight, 36, audio);
      } else if (this.rocketMesh.position.y < ground + 0.3) {
        this.rocketActive = false;
        this.rocketMesh.visible = false;
        this.explodeAt(this.rocketMesh.position.clone(), audio);
      }
    }
  }

  poseContact(flight) {
    const e = this.enemies.find((en) => en.alive);
    if (!e) return;
    const dir = flight.aimDir();
    const x = flight.position.x + dir.x * 16;
    const z = flight.position.z + dir.z * 16;
    e.homeX = x;
    e.homeZ = z;
    e.x = x;
    e.z = z;
    e.feetY = Math.max(terrainHeight(x, z), 0);
    e.y = e.feetY + 1.05;
    e.alert = true;
    e.group.position.set(x, e.feetY, z);
    e.group.rotation.y = Math.atan2(flight.position.x - x, flight.position.z - z) + Math.PI;
    e.group.rotation.z = 0;
  }

  stageTracers(flight, aimPoint) {
    const origin = flight.eyePosition();
    const dir = aimPoint.clone().sub(origin);
    if (dir.lengthSq() < 0.001) return;
    dir.normalize();
    for (let i = 0; i < 5; i++) {
      const slot = this.tracerPool[i];
      slot.mesh.position.copy(origin).addScaledVector(dir, 1.5 + i * 2.4);
      slot.mesh.lookAt(slot.mesh.position.clone().add(dir));
      slot.mesh.material.color.set(0xfff1c2);
      slot.life = 2;
      slot.mesh.visible = true;
    }
  }
}
