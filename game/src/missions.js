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
    this.message = 'Take off and fly through the orange rings';
    this.crateDropped = false;
    this.crateLanded = false;
    this.lastCombatScore = 0;
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
      if (d < 17) {
        this.score += 200;
        audio.chime(this.ringIndex);
        rings[this.ringIndex].material.color.set(0x7dff8a);
        this.ringIndex++;
        if (this.ringIndex >= RING_PATH.length) {
          this.stage = 1;
          this.message = 'Destroy the installations. Click fires cannons, X flares, T gunner mode';
        } else {
          this.message = `Ring ${this.ringIndex} of ${RING_PATH.length} lit`;
        }
      }
    } else if (this.stage === 1) {
      if (combat && combat.installationsLeft() === 0) {
        this.stage = 2;
        this.message = 'Installations destroyed. Drop the crate on the village with Space';
      } else if (combat) {
        this.message = `Destroy the installations. ${combat.installationsLeft()} left. T gunner mode, X flares`;
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
          this.message = 'Land on the runway or beside the boat';
        }
      }
    } else if (this.stage === 3) {
      if (flight.landed && !flight.airborne) {
        this.score += Math.round(flight.fuel) + Math.round(flight.hull);
        this.grade = this.score > 2100 ? 'S' : this.score > 1700 ? 'A' : this.score > 1200 ? 'B' : 'C';
        this.done = true;
        this.message = `Sortie complete. Grade ${this.grade}. Score ${this.score}`;
        audio.fanfare();
      }
    }
    if (flight.crashed) {
      this.done = true;
      this.message = 'Aircraft down. Press R to restart';
    }
  }

  currentTarget(flight, combat) {
    if (this.stage === 0) return RING_PATH[this.ringIndex];
    if (this.stage === 1 && combat) return combat.nearestTarget(flight);
    if (this.stage === 2) return { x: WORLD.village.x, y: 60, z: WORLD.village.z };
    return { x: WORLD.runway.x, y: 30, z: WORLD.runway.z };
  }
}
