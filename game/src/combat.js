// Air-to-ground combat: installations, flak, missiles, flares, gunner autopilot.
import * as THREE from 'three';
import { WORLD, clamp } from './config.js';
import { terrainHeight } from './terrain.js';

const INSTALLATIONS = [
  { name: 'Radar station', x: -700, z: -500, hp: 60, kind: 'radar' },
  { name: 'AAA battery west', x: -300, z: 320, hp: 50, kind: 'aaa' },
  { name: 'AAA battery east', x: 920, z: -220, hp: 50, kind: 'aaa' },
  { name: 'Supply depot', x: 220, z: -820, hp: 70, kind: 'depot' },
];

function buildInstallation(def) {
  const g = new THREE.Group();
  const y = Math.max(terrainHeight(def.x, def.z), 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 3, 10), new THREE.MeshLambertMaterial({ color: 0x6b6f66 }));
  base.position.y = 1.5;
  g.add(base);
  if (def.kind === 'radar') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 16, 8), new THREE.MeshLambertMaterial({ color: 0x9aa3a8 }));
    tower.position.y = 10;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshLambertMaterial({ color: 0xd8dee2, side: THREE.DoubleSide }));
    dish.position.y = 19;
    dish.rotation.x = 0.7;
    g.add(tower, dish);
  } else if (def.kind === 'aaa') {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshLambertMaterial({ color: 0x55604e }));
    mount.position.y = 5;
    g.add(mount);
    for (const dx of [-1.6, 1.6]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 11, 6), new THREE.MeshLambertMaterial({ color: 0x2b2f33 }));
      barrel.position.set(dx, 10, 0);
      barrel.rotation.x = -0.7;
      g.add(barrel);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const shed = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 8), new THREE.MeshLambertMaterial({ color: 0x7a6a4a }));
      shed.position.set((i - 1) * 13, 4, (i % 2) * 6 - 3);
      g.add(shed);
    }
  }
  const smoke = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 9, 52, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2a2724, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  smoke.position.y = 30;
  g.add(smoke);
  g.position.set(def.x, y, def.z);
  return { group: g, smoke };
}

function poolSphere(scene, radius, color, n) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 7, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.visible = false;
    scene.add(mesh);
    slots.push({ mesh, life: 0, vel: new THREE.Vector3(), state: 'idle' });
  }
  return slots;
}

function aircraftPoint(flight, x, y, z) {
  const local = new THREE.Vector3(x, y, z);
  local.applyEuler(new THREE.Euler(-flight.pitch, flight.heading + Math.PI, flight.roll, 'YXZ'));
  return local.add(flight.position);
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.targets = INSTALLATIONS.map((def) => {
      const built = buildInstallation(def);
      scene.add(built.group);
      return {
        ...def,
        group: built.group,
        smoke: built.smoke,
        y: built.group.position.y + 8,
        alive: true,
        hpLeft: def.hp,
        missileTimer: 4 + Math.random() * 4,
        flakTimer: 1.5 + Math.random() * 2,
      };
    });
    this.trucks = [];
    for (let i = 0; i < 3; i++) {
      const truck = new THREE.Group();
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x55604e }));
      cab.position.set(3.4, 1.6, 0);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2, 2.6), new THREE.MeshLambertMaterial({ color: 0x6b7a5e }));
      bed.position.set(-1.4, 1.4, 0);
      truck.add(cab, bed);
      scene.add(truck);
      this.trucks.push({ group: truck, alive: true, hpLeft: 20, offset: i * 90, kind: 'truck', name: 'Truck' });
    }
    this.tracerPool = [];
    for (let i = 0; i < 40; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      t.visible = false;
      scene.add(t);
      this.tracerPool.push({ mesh: t, vel: new THREE.Vector3(), life: 0 });
    }
    this.missile = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 5.5, 8), new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
    this.missile.visible = false;
    scene.add(this.missile);
    this.missileVel = new THREE.Vector3();
    this.missileActive = false;
    this.flareMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
    this.flareMesh.visible = false;
    scene.add(this.flareMesh);
    this.flareVel = new THREE.Vector3();
    this.boom = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9d3c, transparent: true, opacity: 0 }));
    scene.add(this.boom);
    this.boomLife = 0;
    this.muzzles = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: 0 }));
      scene.add(m);
      return m;
    });
    this.muzzleLife = 0;
    this.flakPool = poolSphere(scene, 3.2, 0xffd27a, 6);
    this.dustPool = poolSphere(scene, 1.6, 0xc4b49a, 10);
    this.trail = poolSphere(scene, 0.7, 0xffe2b0, 16);
    this.hurt = poolSphere(scene, 1.1, 0x3a3836, 8);
    this.trailAcc = 0;
    this.hurtAcc = 0;
    this.reset();
  }

  reset() {
    this.ammo = 320;
    this.flares = 12;
    this.flareCooldown = 0;
    this.flareLife = 0;
    this.fireCooldown = 0;
    this.gunSide = 1;
    this.gunner = false;
    this.missileWarning = false;
    this.destroyed = 0;
    this.scoreGained = 0;
    this.recoil = 0;
    this.hitMarker = 0;
    this.nearMissed = false;
    this.missileActive = false;
    if (this.missile) this.missile.visible = false;
    if (this.targets) {
      for (const t of this.targets) {
        t.alive = true;
        t.hpLeft = t.hp;
        t.group.visible = true;
        t.group.rotation.z = 0;
        t.smoke.material.opacity = 0;
        t.missileTimer = 4 + Math.random() * 4;
        t.flakTimer = 1.6 + Math.random() * 2;
      }
      for (const t of this.trucks) { t.alive = true; t.hpLeft = 20; t.group.visible = true; }
    }
    for (const pool of [this.flakPool, this.dustPool, this.trail, this.hurt]) {
      if (!pool) continue;
      for (const slot of pool) {
        slot.life = 0;
        slot.state = 'idle';
        slot.mesh.visible = false;
        slot.mesh.material.opacity = 0;
      }
    }
  }

  installationsLeft() {
    return this.targets.filter((t) => t.alive).length;
  }

  nearestTarget(flight) {
    let best = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - flight.position.x, t.z - flight.position.z);
      if (d < bestD) { bestD = d; best = { x: t.x, y: t.y, z: t.z }; }
    }
    return best || { x: WORLD.village.x, y: 60, z: WORLD.village.z };
  }

  autopilot(dt, flight) {
    flight.bleed(dt);
    const cx = WORLD.village.x;
    const cz = WORLD.village.z;
    const radius = 520;
    const angle = Math.atan2(flight.position.x - cx, flight.position.z - cz);
    const targetAngle = angle + dt * 0.14;
    const tx = cx + Math.sin(targetAngle) * radius;
    const tz = cz + Math.cos(targetAngle) * radius;
    const floor = Math.max(terrainHeight(tx, tz), 0) + 80;
    const ty = Math.max(floor, 210);
    flight.position.x += (tx - flight.position.x) * clamp(dt * 1.6, 0, 1);
    flight.position.z += (tz - flight.position.z) * clamp(dt * 1.6, 0, 1);
    flight.position.y += (ty - flight.position.y) * clamp(dt * 1.2, 0, 1);
    const ground = Math.max(terrainHeight(flight.position.x, flight.position.z), 0) + 48;
    if (flight.position.y < ground) flight.position.y = ground;
    flight.heading = Math.atan2(Math.cos(targetAngle), -Math.sin(targetAngle)) + Math.PI / 2;
    flight.roll = -0.42;
    flight.pitch = 0.02;
    flight.speed = 46;
    flight.throttle = 0.7;
    flight.rpm += (0.7 - flight.rpm) * clamp(dt * 2, 0, 1);
    flight.airborne = true;
    flight.verticalSpeed = 0;
  }

  deployFlare(flight, audio) {
    if (this.flares <= 0 || this.flareCooldown > 0) return false;
    this.flares--;
    this.flareCooldown = 1;
    this.flareLife = 3.2;
    this.flareMesh.visible = true;
    this.flareMesh.position.copy(flight.position).add(new THREE.Vector3(0, -3, 0));
    this.flareVel.copy(flight.forward()).multiplyScalar(-flight.speed * 0.35).add(new THREE.Vector3(0, -12, 0));
    if (audio) audio.flare();
    return true;
  }

  fire(flight, aimPoint, audio) {
    if (this.ammo <= 0 || this.fireCooldown > 0) return;
    this.fireCooldown = 0.09;
    this.ammo--;
    this.gunSide *= -1;
    this.recoil = 1;
    const origin = aircraftPoint(flight, this.gunSide * 3.2, -0.35, 1.5);
    const slot = this.tracerPool.find((t) => t.life <= 0);
    if (slot) {
      const dir = aimPoint.clone().sub(origin);
      if (dir.lengthSq() < 1) dir.copy(flight.forward());
      dir.normalize();
      slot.mesh.position.copy(origin);
      slot.mesh.lookAt(origin.clone().add(dir));
      slot.vel.copy(dir).multiplyScalar(460);
      slot.life = 1.5;
      slot.mesh.visible = true;
    }
    this.muzzles.forEach((m, i) => {
      const p = aircraftPoint(flight, (i === 0 ? -1 : 1) * 3.4, -0.3, 2.2);
      m.position.copy(p);
    });
    this.muzzleLife = 0.045;
    audio.cannon();
  }

  explodeAt(pos, audio) {
    this.boom.position.copy(pos);
    this.boomLife = 0.55;
    audio.explosion();
  }

  dustAt(pos) {
    const slot = this.dustPool.find((d) => d.life <= 0);
    if (!slot) return;
    slot.life = 0.35;
    slot.mesh.visible = true;
    slot.mesh.position.copy(pos);
    slot.mesh.scale.set(1, 1, 1);
    slot.mesh.material.opacity = 0.45;
    slot.mesh.material.color.set(0xcbbba4);
  }

  puff(pool, pos, life, scale, color) {
    const slot = pool.find((d) => d.life <= 0);
    if (!slot) return;
    slot.life = life;
    slot.mesh.visible = true;
    slot.mesh.position.copy(pos);
    slot.mesh.scale.setScalar(scale);
    slot.mesh.material.opacity = 0.55;
    slot.mesh.material.color.set(color);
  }

  hurtAircraft(flight, amount, shake) {
    flight.hull = Math.max(0, flight.hull - amount);
    flight.hitFlash = 1;
    flight.shake = Math.max(flight.shake, shake);
    if (flight.hull <= 0) flight.crashed = true;
  }

  launchFlak(battery, flight) {
    const slot = this.flakPool.find((f) => f.life <= 0);
    if (!slot) return;
    const lead = flight.forward().multiplyScalar(flight.speed * 0.5);
    const dest = flight.position.clone().add(lead).add(new THREE.Vector3(
      (Math.random() - 0.5) * 56,
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 56,
    ));
    const origin = new THREE.Vector3(battery.x, battery.y + 4, battery.z);
    const vel = dest.sub(origin);
    const dist = Math.max(vel.length(), 1);
    vel.multiplyScalar(Math.min(240, dist / 0.95) / dist);
    slot.vel.copy(vel);
    slot.mesh.position.copy(origin);
    slot.mesh.scale.setScalar(0.28);
    slot.mesh.material.color.set(0xffd27a);
    slot.mesh.material.opacity = 1;
    slot.mesh.visible = true;
    slot.life = 1.05;
    slot.state = 'fly';
  }

  damageTarget(t, dmg, audio, flight) {
    t.hpLeft -= dmg;
    this.hitMarker = 0.14;
    if (t.hpLeft <= 0 && t.alive) {
      t.alive = false;
      if (t.group) t.group.rotation.z = 0.5;
      this.destroyed++;
      this.scoreGained += t.kind === 'truck' ? 80 : t.kind === 'depot' ? 200 : 250;
      const at = t.group ? t.group.position.clone().add(new THREE.Vector3(0, 8, 0)) : new THREE.Vector3(t.x, t.y, t.z);
      this.explodeAt(at, audio);
      if (flight) flight.shake = Math.max(flight.shake, 0.4);
      if (t.smoke) t.smoke.material.opacity = 0.5;
    }
  }

  update(dt, flight, aimPoint, firing, audio) {
    this.fireCooldown -= dt;
    this.flareCooldown -= dt;
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.boomLife > 0) {
      this.boomLife -= dt;
      const s = 1 + (0.55 - this.boomLife) * 4;
      this.boom.scale.set(s, s, s);
      this.boom.material.opacity = clamp(this.boomLife * 1.5, 0, 0.85);
    } else this.boom.material.opacity = 0;

    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      const a = clamp(this.muzzleLife / 0.045, 0, 1);
      for (const m of this.muzzles) m.material.opacity = a;
    } else {
      for (const m of this.muzzles) m.material.opacity = 0;
    }

    for (const t of this.targets) {
      if (!t.alive && t.smoke.material.opacity > 0) {
        t.smoke.rotation.y += dt * 0.4;
        t.smoke.material.opacity = 0.42 + Math.sin(performance.now() / 400) * 0.06;
      }
    }

    const convoyT = performance.now() / 1000;
    for (const truck of this.trucks) {
      if (!truck.alive) continue;
      const x = WORLD.village.x - 500 + ((convoyT * 9 + truck.offset) % 1000);
      const z = WORLD.village.z + 260;
      truck.group.position.set(x, Math.max(terrainHeight(x, z), 0) + 1, z);
      truck.group.rotation.y = Math.PI / 2;
      truck.x = x; truck.z = z; truck.y = truck.group.position.y + 2;
    }

    if (firing && flight.airborne && !flight.crashed) this.fire(flight, aimPoint, audio);

    for (const slot of this.tracerPool) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.mesh.position.addScaledVector(slot.vel, dt);
      const p = slot.mesh.position;
      const ground = Math.max(terrainHeight(p.x, p.z), 0);
      let hit = false;
      for (const t of [...this.targets, ...this.trucks]) {
        if (!t.alive) continue;
        const tx = t.x;
        const ty = t.y || 0;
        const tz = t.z;
        if (Math.hypot(p.x - tx, p.y - ty, p.z - tz) < (t.kind === 'truck' ? 8 : 16)) {
          this.damageTarget(t, t.kind === 'truck' ? 10 : 12, audio, flight);
          hit = true;
          break;
        }
      }
      if (hit || p.y <= ground + 0.5 || slot.life <= 0) {
        if (!hit && p.y <= ground + 0.5) this.dustAt(p);
        slot.life = 0;
        slot.mesh.visible = false;
      }
    }

    if (this.flareLife > 0) {
      this.flareLife -= dt;
      this.flareVel.y -= 6 * dt;
      this.flareMesh.position.addScaledVector(this.flareVel, dt);
      this.flareMesh.scale.setScalar(1 + (3.2 - this.flareLife) * 0.35);
      if (this.flareLife <= 0) this.flareMesh.visible = false;
    }

    for (const f of this.flakPool) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.state === 'fly') {
        f.mesh.position.addScaledVector(f.vel, dt);
        if (f.life <= 0) {
          f.state = 'burst';
          f.life = 0.42;
          f.mesh.material.color.set(0x2e2b28);
          const d = f.mesh.position.distanceTo(flight.position);
          if (d < 18 && flight.airborne) {
            this.hurtAircraft(flight, 8, 1.35);
            audio.explosion();
          } else audio.flak();
        }
      } else {
        const s = 1.4 + (0.42 - f.life) * 7;
        f.mesh.scale.setScalar(s);
        f.mesh.material.opacity = clamp(f.life * 1.5, 0, 0.65);
        if (f.life <= 0) f.mesh.visible = false;
      }
    }

    this.missileWarning = false;
    if (!this.missileActive && flight.airborne && !flight.crashed) {
      for (const t of this.targets) {
        if (!t.alive || t.kind !== 'aaa') continue;
        const d = Math.hypot(t.x - flight.position.x, t.z - flight.position.z);
        t.flakTimer -= dt;
        if (d < 620 && t.flakTimer <= 0) {
          t.flakTimer = 2.3 + Math.random() * 1.4;
          this.launchFlak(t, flight);
        }
        t.missileTimer -= dt;
        if (d < 1050 && t.missileTimer <= 0) {
          t.missileTimer = 7 + Math.random() * 4;
          this.missileActive = true;
          this.nearMissed = false;
          this.missile.visible = true;
          this.missile.position.set(t.x, t.y + 6, t.z);
          this.missileVel.set(0, 48, 0);
          audio.missileWarn();
          break;
        }
      }
    }
    if (this.missileActive) {
      this.missileWarning = true;
      const targetPos = this.flareLife > 0 ? this.flareMesh.position : flight.position;
      const desired = targetPos.clone().sub(this.missile.position).normalize().multiplyScalar(155);
      this.missileVel.lerp(desired, clamp(dt * 2.1, 0, 1));
      this.missile.position.addScaledVector(this.missileVel, dt);
      this.missile.lookAt(this.missile.position.clone().add(this.missileVel));
      this.trailAcc -= dt;
      if (this.trailAcc <= 0) {
        this.trailAcc = 0.035;
        this.puff(this.trail, this.missile.position, 0.45, 1, 0xffe2b0);
      }
      const dFlare = this.missile.position.distanceTo(this.flareMesh.position);
      const dPlane = this.missile.position.distanceTo(flight.position);
      if (dPlane < 36) flight.shake = Math.max(flight.shake, (36 - dPlane) / 36 * 0.7);
      if (!this.nearMissed && dPlane < 24 && this.flareLife <= 0) {
        this.nearMissed = true;
        audio.whoosh();
      }
      let end = false;
      if (this.flareLife > 0 && dFlare < 16) {
        end = true;
        this.scoreGained += 40;
        this.explodeAt(this.missile.position.clone(), audio);
      } else if (dPlane < 11) {
        end = true;
        this.hurtAircraft(flight, 18, 2.1);
        this.explodeAt(flight.position.clone(), audio);
      } else if (this.missile.position.y < Math.max(terrainHeight(this.missile.position.x, this.missile.position.z), 0)) {
        end = true;
        this.dustAt(this.missile.position);
      }
      if (end) {
        this.missileActive = false;
        this.missile.visible = false;
      }
    }

    if (flight.hull < 58 && flight.airborne && !flight.crashed) {
      this.hurtAcc -= dt;
      if (this.hurtAcc <= 0) {
        this.hurtAcc = 0.09;
        const behind = aircraftPoint(flight, (Math.random() - 0.5) * 2, 0.4, 6);
        this.puff(this.hurt, behind, 0.7, 0.8 + (58 - flight.hull) / 70, 0x2c2a28);
      }
    }
    for (const slot of this.dustPool) this.fadePuff(slot, dt, 3);
    for (const slot of this.trail) this.fadePuff(slot, dt, 2);
    for (const slot of this.hurt) this.fadePuff(slot, dt, 8);
  }

  fadePuff(slot, dt, rise) {
    if (slot.life <= 0) return;
    slot.life -= dt;
    slot.mesh.position.y += dt * rise;
    slot.mesh.material.opacity = clamp(slot.life * 1.3, 0, 0.55);
    if (slot.life <= 0) slot.mesh.visible = false;
  }

  stageTracers(flight, aimPoint) {
    for (let i = 0; i < 8; i++) {
      const slot = this.tracerPool[i];
      const origin = flight.position.clone().add(new THREE.Vector3(i % 2 ? 3 : -3, -0.4, 0));
      const dir = aimPoint.clone().sub(origin).normalize();
      slot.mesh.position.copy(origin).addScaledVector(dir, 40 + i * 46);
      slot.mesh.lookAt(slot.mesh.position.clone().add(dir));
      slot.vel.copy(dir).multiplyScalar(420);
      slot.life = 1.6;
      slot.mesh.visible = true;
    }
  }
}
