// Air-to-ground combat: installations, AAA missiles, flares, gunner autopilot.
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
  g.position.set(def.x, y, def.z);
  return g;
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.reset();
    this.targets = INSTALLATIONS.map((def) => {
      const group = buildInstallation(def);
      scene.add(group);
      return { ...def, group, y: group.position.y + 8, alive: true, hpLeft: def.hp, missileTimer: 4 + Math.random() * 4 };
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
      this.trucks.push({ group: truck, alive: true, hpLeft: 20, offset: i * 90 });
    }
    this.tracerPool = [];
    for (let i = 0; i < 40; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      t.visible = false;
      scene.add(t);
      this.tracerPool.push({ mesh: t, vel: new THREE.Vector3(), life: 0 });
    }
    this.missile = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    this.missile.visible = false;
    scene.add(this.missile);
    this.missileVel = new THREE.Vector3();
    this.missileActive = false;
    this.flareMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    this.flareMesh.visible = false;
    scene.add(this.flareMesh);
    this.flareVel = new THREE.Vector3();
    this.boom = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff9d3c, transparent: true, opacity: 0 }));
    scene.add(this.boom);
    this.boomLife = 0;
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
    if (this.targets) {
      for (const t of this.targets) { t.alive = true; t.hpLeft = t.hp; t.group.visible = true; t.group.rotation.z = 0; }
      for (const t of this.trucks) { t.alive = true; t.hpLeft = 20; t.group.visible = true; }
      this.missileActive = false;
      this.missile.visible = false;
    }
  }

  installationsLeft() {
    return this.targets.filter((t) => t.alive && t.kind !== 'depot').length + (this.targets.find((t) => t.kind === 'depot')?.alive ? 1 : 0);
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
    const cx = WORLD.village.x;
    const cz = WORLD.village.z;
    const radius = 520;
    const angle = Math.atan2(flight.position.x - cx, flight.position.z - cz);
    const targetAngle = angle + dt * 0.14;
    const tx = cx + Math.sin(targetAngle) * radius;
    const tz = cz + Math.cos(targetAngle) * radius;
    const ty = Math.max(terrainHeight(tx, tz), 0) + 230;
    flight.position.x += (tx - flight.position.x) * clamp(dt * 1.6, 0, 1);
    flight.position.z += (tz - flight.position.z) * clamp(dt * 1.6, 0, 1);
    flight.position.y += (ty - flight.position.y) * clamp(dt * 1.2, 0, 1);
    flight.heading = Math.atan2(Math.cos(targetAngle), -Math.sin(targetAngle)) + Math.PI / 2;
    flight.roll = -0.42;
    flight.pitch = 0.02;
    flight.speed = 46;
    flight.throttle = 0.7;
    flight.rpm = 0.7;
    flight.airborne = true;
    flight.verticalSpeed = 0;
  }

  deployFlare(flight) {
    if (this.flares <= 0 || this.flareCooldown > 0) return false;
    this.flares--;
    this.flareCooldown = 1;
    this.flareLife = 3;
    this.flareMesh.visible = true;
    this.flareMesh.position.copy(flight.position).add(new THREE.Vector3(0, -3, 0));
    this.flareVel.copy(flight.forward()).multiplyScalar(-flight.speed * 0.3).add(new THREE.Vector3(0, -14, 0));
    return true;
  }

  fire(flight, aimPoint, audio) {
    if (this.ammo <= 0 || this.fireCooldown > 0) return;
    this.fireCooldown = 0.09;
    this.ammo--;
    this.gunSide *= -1;
    const slot = this.tracerPool.find((t) => t.life <= 0);
    if (!slot) return;
    const origin = flight.position.clone().add(new THREE.Vector3(this.gunSide * 3, -0.4, 0));
    const dir = aimPoint.clone().sub(origin).normalize();
    slot.mesh.position.copy(origin);
    slot.mesh.lookAt(origin.clone().add(dir));
    slot.vel.copy(dir).multiplyScalar(420);
    slot.life = 1.6;
    slot.mesh.visible = true;
    audio.cannon();
  }

  explodeAt(pos, audio) {
    this.boom.position.copy(pos);
    this.boomLife = 0.5;
    audio.explosion();
  }

  damageTarget(t, dmg, audio) {
    t.hpLeft -= dmg;
    if (t.hpLeft <= 0 && t.alive) {
      t.alive = false;
      t.group.rotation.z = 0.5;
      this.destroyed++;
      this.scoreGained += t.kind === 'depot' ? 200 : 250;
      this.explodeAt(t.group.position.clone().add(new THREE.Vector3(0, 8, 0)), audio);
    }
  }

  update(dt, flight, aimPoint, firing, audio) {
    this.fireCooldown -= dt;
    this.flareCooldown -= dt;
    if (this.boomLife > 0) {
      this.boomLife -= dt;
      const s = 1 + (0.5 - this.boomLife) * 3;
      this.boom.scale.set(s, s, s);
      this.boom.material.opacity = clamp(this.boomLife * 1.6, 0, 0.85);
    } else this.boom.material.opacity = 0;

    const convoyT = performance.now() / 1000;
    for (const truck of this.trucks) {
      if (!truck.alive) continue;
      const x = WORLD.village.x - 500 + ((convoyT * 9 + truck.offset) % 1000);
      const z = WORLD.village.z + 260;
      truck.group.position.set(x, Math.max(terrainHeight(x, z), 0) + 1, z);
      truck.group.rotation.y = Math.PI / 2;
      truck.x = x; truck.z = z; truck.y = truck.group.position.y + 2;
    }

    if (firing && flight.airborne) this.fire(flight, aimPoint, audio);

    for (const slot of this.tracerPool) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.mesh.position.addScaledVector(slot.vel, dt);
      const p = slot.mesh.position;
      const ground = Math.max(terrainHeight(p.x, p.z), 0);
      let hit = false;
      for (const t of [...this.targets, ...this.trucks]) {
        if (!t.alive) continue;
        const d = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
        if (d < 22) {
          this.damageTarget(t, 12, audio);
          hit = true;
          break;
        }
      }
      if (hit || p.y <= ground + 0.5 || slot.life <= 0) {
        if (p.y <= ground + 0.5 && !hit) this.explodeAt(p.clone(), audio);
        slot.life = 0;
        slot.mesh.visible = false;
      }
    }

    if (this.flareLife > 0) {
      this.flareLife -= dt;
      this.flareVel.y -= 6 * dt;
      this.flareMesh.position.addScaledVector(this.flareVel, dt);
      if (this.flareLife <= 0) this.flareMesh.visible = false;
    }

    this.missileWarning = false;
    if (!this.missileActive && flight.airborne) {
      for (const t of this.targets) {
        if (!t.alive || t.kind !== 'aaa') continue;
        const d = Math.hypot(t.x - flight.position.x, t.z - flight.position.z);
        t.missileTimer -= dt;
        if (d < 1050 && t.missileTimer <= 0) {
          t.missileTimer = 6 + Math.random() * 4;
          this.missileActive = true;
          this.missile.visible = true;
          this.missile.position.set(t.x, t.y + 6, t.z);
          this.missileVel.set(0, 40, 0);
          audio.missileWarn();
          break;
        }
      }
    }
    if (this.missileActive) {
      this.missileWarning = true;
      const targetPos = this.flareLife > 0 ? this.flareMesh.position : flight.position;
      const desired = targetPos.clone().sub(this.missile.position).normalize().multiplyScalar(150);
      this.missileVel.lerp(desired, clamp(dt * 2.2, 0, 1));
      this.missile.position.addScaledVector(this.missileVel, dt);
      this.missile.lookAt(this.missile.position.clone().add(this.missileVel));
      const dFlare = this.missile.position.distanceTo(this.flareMesh.position);
      const dPlane = this.missile.position.distanceTo(flight.position);
      if (this.flareLife > 0 && dFlare < 14) {
        this.missileActive = false;
        this.missile.visible = false;
        this.explodeAt(this.missile.position.clone(), audio);
        this.scoreGained += 40;
      } else if (dPlane < 11) {
        this.missileActive = false;
        this.missile.visible = false;
        flight.hull = Math.max(0, flight.hull - 16);
        this.explodeAt(flight.position.clone(), audio);
      } else if (this.missile.position.y < Math.max(terrainHeight(this.missile.position.x, this.missile.position.z), 0)) {
        this.missileActive = false;
        this.missile.visible = false;
      }
    }
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
