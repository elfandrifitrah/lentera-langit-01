// Mission sequence: rings, combat strike, supply drop, landing finish, grading.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';
import { terrainHeight } from './terrain.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.reset();
    this.crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xc98a3d }),
    );
    this.crate.visible = false;
    scene.add(this.crate);
    this.crateVel = new THREE.Vector3();
  }

  reset() {
    this.stage = 0;
    this.ringIndex = 0;
    this.score = 0;
    this.time = 0;
    this.done = false;
    this.grade = '';
    this.message = 'Pull the nose up to rotate, then light the orange rings';
    this.crateDropped = false;
    this.crateLanded = false;
    this.lastCombatScore = 0;
    this.toast = '';
    this.toastTime = 0;
    this.pendingBurst = null;
  }

  say(text, seconds = 1.8) {
    this.toast = text;
    this.toastTime = seconds;
  }

  statusLine(flight, combat) {
    const tgt = this.currentTarget(flight, combat);
    const dist = Math.round(Math.hypot(flight.position.x - tgt.x, flight.position.z - tgt.z));
    if (!flight.airborne && flight.speed > 18 && this.stage === 0) return 'Pull the nose up to rotate';
    if (this.stage === 0) return `Light the rings · ${this.ringIndex + 1} of ${RING_PATH.length} · ${dist} m`;
    if (this.stage === 1) return `Silence the guns · ${combat ? combat.installationsLeft() : 4} left · ${dist} m`;
    if (this.stage === 2) return `Drop the crate on the village · Space · ${dist} m`;
    if (!flight.airborne && flight.landed) return 'Chop the throttle and roll to a stop';
    return `Land on the strip or beside the boat · ${dist} m`;
  }

  dropCrate(flight) {
    if (this.stage !== 2 || this.crateDropped) return false;
    this.crateDropped = true;
    this.crate.visible = true;
    this.crate.position.copy(flight.position);
    this.crateVel.copy(flight.forward()).multiplyScalar(flight.speed * 0.7);
    return true;
  }

  update(dt, flight, rings, audio, combat) {
    if (this.done) return;
    this.time += dt;
    if (combat) {
      this.score += combat.scoreGained - this.lastCombatScore;
      this.lastCombatScore = combat.scoreGained;
    }
    if (this.stage === 0) {
      const target = RING_PATH[this.ringIndex];
      const d = flight.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z));
      if (d < 18) {
        this.score += 200;
        audio.chime(this.ringIndex);
        rings[this.ringIndex].material.color.set(0x7dff8a);
        this.pendingBurst = { x: target.x, y: target.y, z: target.z };
        const lit = this.ringIndex + 1;
        this.ringIndex++;
        if (this.ringIndex >= RING_PATH.length) {
          this.stage = 1;
          this.say('Rings lit. Destroy the radar, the guns, and the depot');
        } else {
          this.say(`Ring ${lit} of ${RING_PATH.length} lit`);
        }
      }
    } else if (this.stage === 1) {
      if (combat && combat.installationsLeft() === 0) {
        this.stage = 2;
        this.say('Guns silent. Drop the crate on the village with Space');
      }
    } else if (this.stage === 2) {
      if (this.crateDropped && !this.crateLanded) {
        this.crateVel.y -= 9.8 * dt;
        this.crate.position.addScaledVector(this.crateVel, dt);
        const ground = Math.max(terrainHeight(this.crate.position.x, this.crate.position.z), 0);
        if (this.crate.position.y <= ground + 0.8) {
          this.crateLanded = true;
          const dist = Math.hypot(this.crate.position.x - WORLD.village.x, this.crate.position.z - WORLD.village.z);
          this.score += Math.max(0, 400 - Math.round(dist));
          audio.thud();
          this.stage = 3;
          this.pendingBurst = { x: WORLD.village.x, y: ground + 12, z: WORLD.village.z };
          this.say(dist < 80 ? 'Supplies on the mark. Bring her home' : 'Crate is down. Land on the strip or beside the boat');
        }
      }
    } else if (this.stage === 3) {
      if (flight.landed && !flight.airborne && flight.speed < 22 && flight.throttle < 0.3) {
        this.score += Math.round(flight.fuel) + Math.round(flight.hull);
        this.grade = this.score > 2100 ? 'S' : this.score > 1700 ? 'A' : this.score > 1200 ? 'B' : 'C';
        this.done = true;
        this.pendingBurst = { x: flight.position.x, y: flight.position.y + 6, z: flight.position.z };
        this.message = `Sortie complete. Grade ${this.grade}. Score ${this.score}`;
        audio.fanfare();
        return;
      }
    }
    if (flight.crashed) {
      this.done = true;
      this.message = 'Aircraft down. Press R to restart';
      return;
    }
    this.toastTime -= dt;
    this.message = this.toastTime > 0 ? this.toast : this.statusLine(flight, combat);
  }

  currentTarget(flight, combat) {
    if (this.stage === 0) return RING_PATH[this.ringIndex];
    if (this.stage === 1 && combat) return combat.nearestTarget(flight);
    if (this.stage === 2) return { x: WORLD.village.x, y: 60, z: WORLD.village.z };
    return { x: WORLD.runway.x, y: 30, z: WORLD.runway.z };
  }
}
