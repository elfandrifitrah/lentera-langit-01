// First-person camera with an over-the-shoulder alternate.
import * as THREE from 'three';
import { clamp, lerp } from './config.js';
import { terrainHeight } from './terrain.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'fps';
    this.distance = 5.4;
    this.smoothed = new THREE.Vector3();
    this.ready = false;
    this.fov = 70;
    this.aimPoint = null;
  }

  toggle() {
    this.mode = this.mode === 'fps' ? 'chase' : 'fps';
    this.ready = false;
  }

  setFov(fov) {
    if (Math.abs(this.camera.fov - fov) > 0.04) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt, flight, combat) {
    const eye = flight.eyePosition();
    const aim = flight.aimDir();
    const moving = clamp(flight.speed / 6, 0, 1);
    const bob = Math.sin(flight.bob * 2) * (flight.crouch ? 0.01 : 0.026) * moving;
    eye.y += bob;
    const right = new THREE.Vector3(Math.cos(flight.heading), 0, -Math.sin(flight.heading));
    eye.addScaledVector(right, Math.cos(flight.bob) * 0.012 * moving);

    const ads = !!(combat && combat.ads && this.mode === 'fps');
    const targetFov = this.mode === 'chase' ? 60 : ads ? 46 : flight.sprinting ? 76 : 70;
    this.fov = lerp(this.fov, targetFov, clamp(dt * 12, 0, 1));
    this.setFov(this.fov);

    const shake = combat ? combat.shake : 0;
    if (shake > 0.01) {
      const t = performance.now() * 0.05;
      eye.x += Math.sin(t) * shake * 0.05;
      eye.y += Math.cos(t * 1.3) * shake * 0.035;
    }

    if (this.mode === 'chase') {
      const flat = new THREE.Vector3(Math.sin(flight.heading), 0, Math.cos(flight.heading));
      const desired = flight.position.clone()
        .addScaledVector(flat, -4.8)
        .addScaledVector(right, 0.7)
        .add(new THREE.Vector3(0, 2.15, 0));
      const floor = Math.max(terrainHeight(desired.x, desired.z), 0) + 0.6;
      if (desired.y < floor) desired.y = floor;
      if (!this.ready) { this.smoothed.copy(desired); this.ready = true; }
      this.smoothed.lerp(desired, clamp(dt * 8, 0, 1));
      this.camera.position.copy(this.smoothed);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(flight.position.clone().add(new THREE.Vector3(0, 1.35, 0)).addScaledVector(flat, 4));
      return;
    }

    this.camera.position.copy(eye);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(eye.clone().add(aim));
    this.camera.rotateZ(-flight.lean * 0.14);
  }
}
