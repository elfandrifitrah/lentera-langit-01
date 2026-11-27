// Ground raid: phase lines, compound clear, secure the cache, extract.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { RING_PATH } from './world-props.js';
import { terrainHeight } from './terrain.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x6d5a32 }),
    );
    const y = Math.max(terrainHeight(WORLD.village.x, WORLD.village.z), 0);
    this.crate.position.set(WORLD.village.x, y + 0.4, WORLD.village.z);
    scene.add(this.crate);
    this.reset();
  }

  reset() {
    this.stage = 0;
    this.ringIndex = 0;
    this.score = 0;
    this.time = 0;
    this.done = false;
    this.grade = '';
    this.message = 'Push the phase lines toward the compounds';
    this.hold = 0;
    this.lastCombatScore = 0;
    this.crateDropped = false;
    this.crateLanded = true;
  }

  update(dt, flight, rings, audio, combat) {
    if (this.done) return;
    this.time += dt;
    if (combat) {
      this.score += combat.scoreGained - this.lastCombatScore;
      this.lastCombatScore = combat.scoreGained;
    }
    if (flight.crashed) {
      this.done = true;
      this.grade = 'C';
      this.message = 'Operator down. Press Enter to restart';
      return;
    }
    if (this.stage === 0) {
      const target = RING_PATH[this.ringIndex];
      const d = Math.hypot(flight.position.x - target.x, flight.position.z - target.z);
      this.message = `Phase line ${this.ringIndex + 1} of ${RING_PATH.length}`;
      if (d < 12) {
        this.score += 150;
        audio.chime(this.ringIndex);
        rings[this.ringIndex].material.color.set(0x8fd18a);
        this.ringIndex += 1;
        if (this.ringIndex >= RING_PATH.length) {
          this.stage = 1;
          this.message = 'Clear the compounds. Smoke breaks a rocket lock';
        }
      }
    } else if (this.stage === 1) {
      const left = combat ? combat.installationsLeft() : 0;
      if (left === 0) {
        this.stage = 2;
        this.hold = 0;
        this.message = 'Compounds clear. Hold on the village cache';
      } else {
        this.message = `Clear the compounds. ${left} still standing`;
      }
    } else if (this.stage === 2) {
      const d = Math.hypot(flight.position.x - WORLD.village.x, flight.position.z - WORLD.village.z);
      if (d < 16) {
        this.hold += dt;
        this.message = `Securing the cache ${Math.max(0, Math.ceil(3 - this.hold))}`;
        if (this.hold >= 3) {
          this.score += 400;
          audio.thud();
          this.stage = 3;
          this.hold = 0;
          this.message = 'Cache secure. Extract on the airstrip';
        }
      } else {
        this.hold = 0;
        this.message = 'Hold on the village cache to secure it';
      }
    } else if (this.stage === 3) {
      const r = WORLD.runway;
      const d = Math.hypot(flight.position.x - r.x, flight.position.z - r.z);
      if (d < 48 && !flight.airborne) {
        this.hold += dt;
        this.message = `Extracting ${Math.max(0, Math.ceil(3 - this.hold))}`;
        if (this.hold >= 3) {
          this.score += Math.round(flight.hull) + Math.round(combat ? combat.armor : 0);
          this.grade = this.score > 2300 ? 'S' : this.score > 1800 ? 'A' : this.score > 1200 ? 'B' : 'C';
          this.done = true;
          this.message = `Raid complete. Grade ${this.grade}. Score ${this.score}`;
          audio.fanfare();
        }
      } else {
        this.hold = 0;
        this.message = 'Return to the airstrip to extract';
      }
    }
  }

  currentTarget(flight, combat) {
    if (this.stage === 0) return RING_PATH[Math.min(this.ringIndex, RING_PATH.length - 1)];
    if (this.stage === 1 && combat) {
      const site = combat.nearestTarget(flight);
      return { x: site.x, y: site.y, z: site.z };
    }
    if (this.stage === 2) return { x: WORLD.village.x, y: 20, z: WORLD.village.z };
    return { x: WORLD.runway.x, y: 10, z: WORLD.runway.z };
  }
}
